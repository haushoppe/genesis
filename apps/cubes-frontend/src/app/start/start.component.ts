import { DecimalPipe, SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { form, min, pattern, required, schema, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import {
  AUTO_SCAN_MAX_VALUE_SAT,
  bucketOf,
  findAutoPickCandidate,
  InscribeMintOrchestrator,
  KnownOrdinalWalletType,
  SimulateInscribeFeesResult,
  TxnOutput,
  UtxoContentScanner,
  UtxoScanBucket,
  UtxoScanState,
  WalletService,
} from 'ordpool-sdk';
import { debounceTime, firstValueFrom, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { CubePreviewComponent } from '../layout/cube-preview/cube-preview.component';
import { CubePreviewTitleComponent } from '../layout/cube-preview/cube-preview-title.component';
import { InscriptionListItemComponent } from '../layout/inscription-list-item/inscription-list-item.component';
import { getCubeHtml } from '../services/cube-html';
import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { CubeSuggestionService } from '../services/cubes-data/cube-suggestion.service';
import { CubeSuggestion } from '../services/cubes-data/types';
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

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  protected readonly walletService = inject(WalletService);
  protected readonly orchestrator = inject(InscribeMintOrchestrator);
  protected readonly pastMints = inject(PastMintsService);
  private readonly scanner = inject(UtxoContentScanner);
  private readonly cubesData = inject(CubesDataService);
  private readonly cubeSuggestionService = inject(CubeSuggestionService);
  private readonly inscriptionLookup = inject(InscriptionLookupService);

  protected readonly autoScanThreshold = AUTO_SCAN_MAX_VALUE_SAT;

  // ---------- Async resources (replaces NgRx effects/reducers) ----------

  /** Cursor over the ordinal-cubes-index — one static JSON blob. */
  protected readonly cursorResource = rxResourceFixed({
    stream: () => this.cubesData.getCursor(),
  });
  protected readonly cursor = computed(() => this.cursorResource.value() ?? null);

  /** Paginated cubes list. Reactive on itemsPerPage + currentPage. */
  protected readonly currentPage = signal(1);
  protected readonly itemsPerPage = signal(DEFAULT_ITEMS_PER_PAGE);

  protected readonly inscriptionsResource = rxResourceFixed({
    params: () => ({ itemsPerPage: this.itemsPerPage(), page: this.currentPage() }),
    stream: ({ params }) => this.cubesData.getInscriptions(params.itemsPerPage, params.page),
  });

  /** Suggestion pool — a fresh cube suggestion for the given collection.
   *  `''` = any collection; changing the trigger reloads. */
  protected readonly suggestionCollection = signal<string>('');
  protected readonly suggestionResource = rxResourceFixed({
    params: () => ({ collection: this.suggestionCollection() }),
    stream: ({ params }) => this.cubeSuggestionService.getCubeSuggestion(params.collection),
  });

  // ---------- Wallet + orchestrator signals ----------

  protected readonly connectedWallet = toSignal(this.walletService.connectedWallet$, { initialValue: null });
  protected readonly wallets = toSignal(this.walletService.wallets$, {
    initialValue: { installedWallets: [], notInstalledWallets: [] },
  });
  protected readonly simulations = toSignal(this.orchestrator.simulations$, { initialValue: [] });
  protected readonly scanStates = toSignal(this.scanner.states$, {
    initialValue: new Map<string, UtxoScanState>() as ReadonlyMap<string, UtxoScanState>,
  });
  protected readonly recommendedFees = toSignal(this.orchestrator.recommendedFees$, { initialValue: null });

  // ---------- Form ----------

  protected readonly mintFormData = signal<MintFormData>(INITIAL_MINT_FORM);
  protected readonly mintForm = form(this.mintFormData, mintFormSchema);

  protected readonly cubeDetails = computed(() => {
    const v = this.mintFormData();
    return {
      inscriptionIds: {
        inscriptionId1: v.inscriptionId1,
        inscriptionId2: v.inscriptionId2,
        inscriptionId3: v.inscriptionId3,
        inscriptionId4: v.inscriptionId4,
        inscriptionId5: v.inscriptionId5,
        inscriptionId6: v.inscriptionId6,
      },
      title: v.title,
      rotationSpeedX: v.rotationSpeedX,
      rotationSpeedY: v.rotationSpeedY,
      colorPane: v.colorPane,
      bgColor1: v.bgColor1,
      bgColor2: v.bgColor2,
    };
  });

  // ---------- Derived state ----------

  protected readonly installedOrdinalsAware = computed(() =>
    this.wallets().installedWallets.filter((w) => w.onChainOrdinals !== false),
  );

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

    // Fee rate → orchestrator, debounced.
    toObservable(this.mintFormData)
      .pipe(map((v) => v.feeRate), debounceTime(150))
      .subscribe((rate) => {
        if (rate && rate > 0) this.orchestrator.setFeeRate(rate);
      });

    // Form → orchestrator content, debounced.
    toObservable(this.mintFormData)
      .pipe(debounceTime(150))
      .subscribe(() => {
        if (!this.mintForm().valid()) return;
        const html = getCubeHtml(this.cubeDetails());
        this.orchestrator.setContent({
          body: new TextEncoder().encode(html),
          contentType: 'text/html;charset=utf-8',
          tip: { address: HAUSHOPPE_TIP_ADDRESS, value: HAUSHOPPE_TIP_SATS },
        });
      });

    // #12345-style inscription-number lookup — debounced per field.
    for (const key of INSCRIPTION_ID_FIELDS) {
      toObservable(this.mintFormData)
        .pipe(map((v) => v[key]), debounceTime(1000))
        .subscribe((value) => {
          const trimmed = value.trim();
          if (!trimmed || !/^\d+$/.test(trimmed)) return;
          this.inscriptionLookup.lookupById(trimmed).subscribe((id) => {
            if (!id) return;
            this.mintFormData.update((v) => ({ ...v, [key]: id }));
          });
        });
    }

    this.orchestrator.setFeeRate(INITIAL_MINT_FORM.feeRate);

    // Fresh suggestions from the resource → patch into the form.
    let lastSuggestion: CubeSuggestion | undefined;
    effect(() => {
      const suggestion = this.suggestionResource.value();
      if (!suggestion || suggestion === lastSuggestion) return;
      lastSuggestion = suggestion;
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

  connectWallet(type: KnownOrdinalWalletType) {
    this.walletService.connectWallet(type).subscribe({
      error: (err) => {
        // eslint-disable-next-line no-console
        console.warn('[cubes] connect failed', type, err);
      },
    });
  }

  startCheckout() {
    if (!this.canOpenCheckout()) return;
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
    this.scanner.scan(`${utxo.txid}:${utxo.vout}`).subscribe();
  }

  setFeePreset(rate: number) {
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
