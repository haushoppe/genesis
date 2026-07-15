import { DecimalPipe, SlicePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { form, min, pattern, required, schema, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import {
  AUTO_SCAN_MAX_VALUE_SAT,
  bucketOf,
  findAutoPickCandidate,
  InscribeMintOrchestrator,
  RecommendedFees,
  SimulateInscribeFeesResult,
  TxnOutput,
  UtxoContentScanner,
  UtxoScanBucket,
  UtxoScanState,
  WalletService,
} from 'ordpool-sdk';
import { debounceTime, firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { CubePreviewComponent } from '../layout/cube-preview/cube-preview.component';
import { CubePreviewTitleComponent } from '../layout/cube-preview/cube-preview-title.component';
import { InscriptionListItemComponent } from '../layout/inscription-list-item/inscription-list-item.component';
import { getCubeHtml } from '../services/cube-html';
import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { CubeSuggestionService } from '../services/cubes-data/cube-suggestion.service';
import { InscriptionLookupService } from '../services/inscription-lookup.service';
import { PastMintsService } from '../services/past-mints.service';
import { rxResourceFixed } from '../shared/utils/rx-resource-fixed';

/**
 * HAUS HOPPE donation address + amount — the reveal tx's optional
 * vout[1] silently tips this on every mint. No user-facing UI. Comes
 * from environment.ts so regtest e2e specs can override to a
 * bcrt1p… address that doesn't dust-reject on the local chain.
 */
const HAUSHOPPE_TIP_ADDRESS = environment.haushoppeTipAddress;
const HAUSHOPPE_TIP_SATS = environment.haushoppeTipSats;

/** txid + `i` + index — the ord canonical inscription-id shape. */
const INSCRIPTION_ID_PATTERN = /^[a-f0-9]{64}i\d+$/;

interface MintFormData {
  inscriptionId1: string;
  inscriptionId2: string;
  inscriptionId3: string;
  inscriptionId4: string;
  inscriptionId5: string;
  inscriptionId6: string;
  title: string;
  rotationSpeedX: string;
  rotationSpeedY: string;
  colorPane: string;
  bgColor1: string;
  bgColor2: string;
  feeRate: number;
}

const INITIAL_MINT_FORM: MintFormData = {
  inscriptionId1: '',
  inscriptionId2: '',
  inscriptionId3: '',
  inscriptionId4: '',
  inscriptionId5: '',
  inscriptionId6: '',
  title: '',
  rotationSpeedX: '',
  rotationSpeedY: '',
  colorPane: '',
  bgColor1: '',
  bgColor2: '',
  feeRate: 10,
};

const mintFormSchema = schema<MintFormData>((path) => {
  required(path.inscriptionId1);
  pattern(path.inscriptionId1, INSCRIPTION_ID_PATTERN);
  required(path.inscriptionId2);
  pattern(path.inscriptionId2, INSCRIPTION_ID_PATTERN);
  required(path.inscriptionId3);
  pattern(path.inscriptionId3, INSCRIPTION_ID_PATTERN);
  required(path.inscriptionId4);
  pattern(path.inscriptionId4, INSCRIPTION_ID_PATTERN);
  required(path.inscriptionId5);
  pattern(path.inscriptionId5, INSCRIPTION_ID_PATTERN);
  required(path.inscriptionId6);
  pattern(path.inscriptionId6, INSCRIPTION_ID_PATTERN);
  required(path.feeRate);
  min(path.feeRate, 1);
});

const INSCRIPTION_ID_FIELDS = [
  'inscriptionId1',
  'inscriptionId2',
  'inscriptionId3',
  'inscriptionId4',
  'inscriptionId5',
  'inscriptionId6',
] as const;

const DEFAULT_ITEMS_PER_PAGE = 12;

/** One row of the expert-panel UTXO picker. */
export interface ViableInscribeSimulation {
  utxo: TxnOutput;
  simulation: SimulateInscribeFeesResult;
  scan: UtxoScanState;
  bucket: UtxoScanBucket;
}

/** One preset button next to the fee-rate input. */
interface FeeTier {
  testId: string;
  label: string;
  title: string;
  key: keyof RecommendedFees;
}

const FEE_TIERS: readonly FeeTier[] = [
  { testId: 'fee-tier-eco',  label: 'Eco',  title: 'Economy',    key: 'economyFee'  },
  { testId: 'fee-tier-hour', label: 'Hour', title: '~1h',        key: 'hourFee'     },
  { testId: 'fee-tier-half', label: 'Half', title: '~30min',     key: 'halfHourFee' },
  { testId: 'fee-tier-fast', label: 'Fast', title: 'Next block', key: 'fastestFee'  },
];

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  imports: [
    InscriptionListItemComponent,
    CubePreviewComponent,
    CubePreviewTitleComponent,
    NgbPagination,
    RouterLink,
    FormField,
    DecimalPipe,
    SlicePipe,
  ],
  host: {
    '(window:keydown)': 'onKeydown($event)',
  },
})
export class StartComponent {
  /** Route param on `/mint/:collectionSymbol` — bound via
   *  `withComponentInputBinding()`. Absent on the plain `/` route,
   *  so default to '' (any collection). */
  readonly collectionSymbol = input<string>('');

  protected readonly walletService = inject(WalletService);
  protected readonly orchestrator = inject(InscribeMintOrchestrator);
  protected readonly pastMints = inject(PastMintsService);
  private readonly scanner = inject(UtxoContentScanner);
  private readonly cubesData = inject(CubesDataService);
  private readonly cubeSuggestionService = inject(CubeSuggestionService);
  private readonly inscriptionLookup = inject(InscriptionLookupService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly autoScanThreshold = AUTO_SCAN_MAX_VALUE_SAT;
  protected readonly feeTiers = FEE_TIERS;

  // ---------- Async resources ----------

  /** Cursor over the ordinal-cubes-index — one static JSON blob. */
  protected readonly cursorResource = rxResourceFixed({
    stream: () => this.cubesData.getCursor(),
  });

  /** Paginated cubes list. Reactive on itemsPerPage + currentPage. */
  protected readonly currentPage = signal(1);
  protected readonly itemsPerPage = signal(DEFAULT_ITEMS_PER_PAGE);

  protected readonly inscriptionsResource = rxResourceFixed({
    params: () => ({ itemsPerPage: this.itemsPerPage(), page: this.currentPage() }),
    stream: ({ params }) => this.cubesData.getInscriptions(params.itemsPerPage, params.page),
  });

  /** Fresh cube suggestion — reactive on the route param (`/mint/:sym`).
   *  Reloading via `.reload()` gets a new pick from the same
   *  collection. */
  protected readonly suggestionResource = rxResourceFixed({
    params: () => ({ collection: this.collectionSymbol() }),
    stream: ({ params }) => this.cubeSuggestionService.getCubeSuggestion(params.collection),
  });

  // ---------- Wallet + orchestrator signals ----------

  protected readonly connectedWallet = toSignal(this.walletService.connectedWallet$, { initialValue: null });
  protected readonly simulations = toSignal(this.orchestrator.simulations$, { initialValue: [] });
  protected readonly scanStates = toSignal(this.scanner.states$, {
    initialValue: new Map<string, UtxoScanState>() as ReadonlyMap<string, UtxoScanState>,
  });
  protected readonly recommendedFees = toSignal(this.orchestrator.recommendedFees$, { initialValue: null });

  // ---------- Form ----------

  protected readonly mintFormData = signal<MintFormData>(INITIAL_MINT_FORM);
  protected readonly mintForm = form(this.mintFormData, mintFormSchema);

  protected readonly cubeDetails = computed(() => {
    const {
      inscriptionId1, inscriptionId2, inscriptionId3,
      inscriptionId4, inscriptionId5, inscriptionId6,
      feeRate: _feeRate, ...rest
    } = this.mintFormData();
    return {
      inscriptionIds: {
        inscriptionId1, inscriptionId2, inscriptionId3,
        inscriptionId4, inscriptionId5, inscriptionId6,
      },
      ...rest,
    };
  });

  // ---------- Derived state ----------

  protected readonly viableRows = computed<ViableInscribeSimulation[]>(() => {
    const rows = this.simulations();
    const scanMap = this.scanStates();
    return rows
      .filter((r): r is { utxo: TxnOutput; simulation: SimulateInscribeFeesResult; insufficient: false } =>
        !r.insufficient && r.simulation !== null,
      )
      .sort((a, b) => b.utxo.value - a.utxo.value)
      .slice(0, 10)
      .map((r): ViableInscribeSimulation => {
        const outpoint = `${r.utxo.txid}:${r.utxo.vout}`;
        const scan = scanMap.get(outpoint) ?? { kind: 'not-scanned' as const };
        return { utxo: r.utxo, simulation: r.simulation, scan, bucket: bucketOf(scan) };
      });
  });

  protected readonly selectedRow = computed<ViableInscribeSimulation | null>(() => {
    const sel = this.orchestrator.selectedUtxo();
    if (!sel) return null;
    return this.viableRows().find(
      (r) => r.utxo.txid === sel.txid && r.utxo.vout === sel.vout,
    ) ?? null;
  });

  protected readonly canMint = computed(() =>
    this.viableRows().length > 0 &&
    this.orchestrator.selectedUtxo() !== null &&
    this.orchestrator.state() === 'ready' &&
    this.mintForm().valid(),
  );

  // ---------- Checkout state ----------

  protected readonly checkoutOpen = signal(false);
  protected readonly canOpenCheckout = computed(() => this.mintForm().valid());

  /** True while the user has clicked Mint but the connect flow hasn't
   *  completed yet. Set by `startCheckout()` when no wallet is connected;
   *  cleared by an effect below the moment a wallet arrives, which then
   *  opens the drawer automatically. */
  private readonly pendingCheckout = signal(false);

  // ---------- Constructor: reactive wiring ----------

  private lastWalletAddress: string | null = null;

  constructor() {
    // Reset the scanner's cache when the wallet changes.
    effect(() => {
      const addr = this.connectedWallet()?.ordinalsAddress ?? null;
      if (this.lastWalletAddress !== null && addr !== this.lastWalletAddress) {
        this.scanner.reset();
      }
      this.lastWalletAddress = addr;
    });

    // If the user clicked Mint while disconnected, we asked the top-right
    // widget for a connect flow. Once a wallet lands, honour that
    // pending intent by opening the drawer.
    effect(() => {
      if (this.pendingCheckout() && this.connectedWallet()) {
        this.pendingCheckout.set(false);
        this.checkoutOpen.set(true);
      }
    });

    // Eager-scan small viable UTXOs.
    effect(() => {
      const rows = this.viableRows();
      this.scanner.autoScan(
        rows.map((r) => ({ txid: r.utxo.txid, vout: r.utxo.vout, value: r.utxo.value })),
      );
    });

    // Auto-pick the safest viable UTXO. Priority lives in the SDK.
    effect(() => {
      const rows = this.viableRows();
      if (rows.length === 0) return;
      const current = untracked(() => this.orchestrator.selectedUtxo());
      const stillThere = current && rows.find(
        (r) => r.utxo.txid === current.txid && r.utxo.vout === current.vout,
      );
      if (stillThere) return;
      const pick = findAutoPickCandidate(rows);
      this.orchestrator.setSelectedUtxo(pick ? pick.utxo : null);
    });

    // Form → orchestrator: fee rate + inscription-body HTML on the same
    // 150 ms tick. `takeUntilDestroyed` ties the subscription to the
    // component's lifetime so a route change doesn't leak callbacks.
    toObservable(this.mintFormData)
      .pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (v.feeRate > 0) this.orchestrator.setFeeRate(v.feeRate);
        if (!this.mintForm().valid()) return;
        const html = getCubeHtml(this.cubeDetails());
        this.orchestrator.setContent({
          body: new TextEncoder().encode(html),
          contentType: 'text/html;charset=utf-8',
          tip: { address: HAUSHOPPE_TIP_ADDRESS, value: HAUSHOPPE_TIP_SATS },
        });
      });

    // #12345-style inscription-number lookup — one shared 1 s debounce
    // that snapshots all six id fields and only looks up the ones that
    // changed to a plain numeric string since the last snapshot.
    const lastSeen: Record<string, string> = {};
    toObservable(this.mintFormData)
      .pipe(debounceTime(1000), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        for (const key of INSCRIPTION_ID_FIELDS) {
          const value = v[key];
          if (value === lastSeen[key]) continue;
          lastSeen[key] = value;
          const trimmed = value.trim();
          if (!trimmed || !/^\d+$/.test(trimmed)) continue;
          this.inscriptionLookup.lookupById(trimmed)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((id) => {
              if (!id) return;
              this.mintFormData.update((f) => f[key] === value ? { ...f, [key]: id } : f);
            });
        }
      });

    this.orchestrator.setFeeRate(INITIAL_MINT_FORM.feeRate);

    // Fresh suggestion from the resource → patch its 6 ids into the
    // form. Angular's signal semantics only fire the effect when
    // `suggestionResource.value()` actually changes reference (each
    // resource resolve produces a new object), so no dedup closure.
    effect(() => {
      const suggestion = this.suggestionResource.value();
      if (!suggestion) return;
      this.mintFormData.update((v) => ({
        ...v,
        inscriptionId1: suggestion.inscriptionId1,
        inscriptionId2: suggestion.inscriptionId2,
        inscriptionId3: suggestion.inscriptionId3,
        inscriptionId4: suggestion.inscriptionId4,
        inscriptionId5: suggestion.inscriptionId5,
        inscriptionId6: suggestion.inscriptionId6,
      }));
    });
  }

  // ---------- Commands ----------

  onKeydown(event: KeyboardEvent) {
    if (isTextInputTarget(event.target)) return;
    const list = this.inscriptionsResource.value();
    if (!list || !list.itemsPerPage) return;
    const lastPage = Math.ceil(list.totalInscriptions / list.itemsPerPage);
    if (event.key === 'ArrowLeft' && list.currentPage > 1) {
      this.currentPage.set(list.currentPage - 1);
    } else if (event.key === 'ArrowRight' && list.currentPage < lastPage) {
      this.currentPage.set(list.currentPage + 1);
    }
  }

  loadInscriptionsPage(page: number) {
    this.currentPage.set(page);
  }

  startCheckout() {
    if (!this.canOpenCheckout()) return;
    // Not connected → hand off to the top-right widget. The pending flag
    // + effect above will open the drawer once a wallet arrives.
    if (!this.connectedWallet()) {
      this.pendingCheckout.set(true);
      this.walletService.requestWalletConnect();
      return;
    }
    this.checkoutOpen.set(true);
  }

  craftAnotherCube() {
    // Reload the suggestion resource — same collection, fresh pick.
    this.suggestionResource.reload();
  }

  cancelCheckout() {
    this.checkoutOpen.set(false);
  }

  async mint() {
    if (!this.canMint()) return;

    // Belt-and-braces: sync content one more time in case the Mint click
    // landed before the debounced form-value subscription fired.
    const html = getCubeHtml(this.cubeDetails());
    this.orchestrator.setContent({
      body: new TextEncoder().encode(html),
      contentType: 'text/html;charset=utf-8',
      tip: { address: HAUSHOPPE_TIP_ADDRESS, value: HAUSHOPPE_TIP_SATS },
    });

    try {
      const result = await firstValueFrom(this.orchestrator.mint());
      this.pastMints.record(result.commitTxId, result.revealTxId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[cubes] mint threw:', err);
    }
  }

  scanUtxo(utxo: TxnOutput) {
    this.scanner.scan(`${utxo.txid}:${utxo.vout}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  setFeePreset(rate: number) {
    // Two writes on purpose: mintFormData for form-value consistency
    // (drives the preview + validity + rendered fee-rate input) and
    // an immediate orchestrator.setFeeRate call so the summary
    // recomputes right away rather than after the 150 ms form debounce.
    this.mintFormData.update((v) => ({ ...v, feeRate: rate }));
    this.orchestrator.setFeeRate(rate);
  }

  bucketLabel(bucket: UtxoScanBucket): string {
    switch (bucket) {
      case 'clean': return 'safe';
      case 'assets': return 'assets on this UTXO';
      case 'unscanned': return 'not scanned';
      case 'scanning': return 'scanning…';
      case 'failed': return 'scan failed';
    }
  }

  mintAnother() {
    this.orchestrator.reset();
    this.mintFormData.set(INITIAL_MINT_FORM);
    this.orchestrator.setFeeRate(INITIAL_MINT_FORM.feeRate);
    this.checkoutOpen.set(false);
  }
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
