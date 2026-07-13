import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { form, min, pattern, required, schema, FormField } from '@angular/forms/signals';
import { DecimalPipe, SlicePipe } from '@angular/common';
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

import { CubePreviewComponent } from '../layout/cube-preview/cube-preview.component';
import { CubePreviewTitleComponent } from '../layout/cube-preview/cube-preview-title.component';
import { InscriptionListItemComponent } from '../layout/inscription-list-item/inscription-list-item.component';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { getCubeHtml } from '../services/cube-html';
import { CubeDetails } from '../store/mint.actions';
import { MintFacade } from '../store/mint.facade';
import { PastFacade } from '../store/past.facade';
import { environment } from '../../environments/environment';

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

/**
 * The mint form's data model. Six required inscription IDs, five
 * optional style fields, one fee rate. Signal Forms derives the
 * whole form structure from this shape.
 */
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

/**
 * Schema: 6 required inscription IDs with the txid+i+index pattern,
 * fee rate required with min 1. Optional fields are left free.
 */
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
    LoadingIndicatorComponent,
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
  protected readonly mintFacade = inject(MintFacade);
  protected readonly pastFacade = inject(PastFacade);
  protected readonly walletService = inject(WalletService);
  protected readonly orchestrator = inject(InscribeMintOrchestrator);
  private readonly scanner = inject(UtxoContentScanner);
  private readonly cubesData = inject(CubesDataService);

  protected readonly autoScanThreshold = AUTO_SCAN_MAX_VALUE_SAT;

  // ---------- Source signals ----------

  protected readonly cursor = toSignal(this.cubesData.getCursor());
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

  /** Live cube preview data — derived from the form data signal. */
  protected readonly cubeDetails = computed<CubeDetails>(() => {
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

  /**
   * Every installed on-chain-ordinals-aware wallet — powers the connect
   * picker. `onChainOrdinals: false` is set upstream on wallets that
   * detect but can't hold ordinal artifacts (Lightning-only Alby with no
   * BTC backend, etc); those get filtered out here so the picker only
   * shows options that can actually complete a cube mint.
   */
  protected readonly installedOrdinalsAware = computed(() =>
    this.wallets().installedWallets.filter((w) => w.onChainOrdinals !== false),
  );

  /**
   * Combines the orchestrator's raw simulation rows with the scanner's
   * asset-scan state. Filters to viable rows, sorts biggest-first, caps
   * at 10, and annotates each with a bucket (clean / assets / unscanned
   * / …). Same shape cat21.space's mint page uses — pure computed, no
   * RxJS side effects.
   */
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

  // ---------- Checkout state ----------

  /**
   * Classic e-commerce funnel: get the customer engaged with the fun
   * part (configure a cube, see it spin) before we hit them with any
   * annoying steps. `checkoutOpen` flips true when the user commits by
   * clicking the CTA — that's the point where we reveal wallet-connect,
   * fee picking, and UTXO review.
   */
  protected readonly checkoutOpen = signal(false);

  /** Enables the top-level "Mint my cube!" CTA. */
  protected readonly canOpenCheckout = computed(() => this.mintForm().valid());

  /**
   * Computed views into orchestrator.successResult() — computed signals
   * are tracked in the template and match cat21-indexer's proven
   * pattern (successTxId() there). Prior `@let` + optional-chain in the
   * template rendered as empty strings even though the SDK's signal
   * clearly held the txids at the moment the template evaluated.
   */
  protected readonly successCommitTxId = computed(
    () => this.orchestrator.successResult()?.commitTxId ?? '',
  );
  protected readonly successRevealTxId = computed(
    () => this.orchestrator.successResult()?.revealTxId ?? '',
  );

  /**
   * Compact diagnostic for the regtest e2e spec — semicolon-joined
   * `<bucket>:<value>` per viable row so the spec can grep the raw
   * scanner state when auto-pick misbehaves.
   */
  protected readonly bucketsDebug = computed(() =>
    this.viableRows()
      .map((r) => `${r.bucket}:${r.utxo.value}`)
      .join(';'),
  );

  /**
   * The full ViableInscribeSimulation row corresponding to the currently
   * selected UTXO. Lets the template read simulation.commitFeeSats etc.
   * without another lookup in each cell.
   */
  protected readonly selectedRow = computed<ViableInscribeSimulation | null>(() => {
    const sel = this.orchestrator.selectedUtxo();
    if (!sel) return null;
    return this.viableRows().find(
      (r) => r.utxo.txid === sel.txid && r.utxo.vout === sel.vout,
    ) ?? null;
  });

  /**
   * Everything the mint button gates on, collapsed into one computed so
   * the template does exactly one signal read for `[disabled]`. All
   * checks are pure signal reads — no form.valid subscription races.
   */
  protected readonly canMint = computed(() =>
    this.viableRows().length > 0 &&
    this.orchestrator.selectedUtxo() !== null &&
    this.orchestrator.state() === 'ready' &&
    this.mintForm().valid(),
  );

  // ---------- Lifecycle ----------

  private lastWalletAddress: string | null = null;

  constructor() {
    // Reset the scanner's cache when the wallet changes. Initial
    // null → wallet is a no-op (scanner is already empty).
    effect(() => {
      const addr = this.connectedWallet()?.ordinalsAddress ?? null;
      if (this.lastWalletAddress !== null && addr !== this.lastWalletAddress) {
        this.scanner.reset();
      }
      this.lastWalletAddress = addr;
    });

    // Eager-scan small viable UTXOs. Scanner dedupes internally so
    // repeat triggers are free.
    effect(() => {
      const rows = this.viableRows();
      this.scanner.autoScan(rows.map((r) => ({ txid: r.utxo.txid, vout: r.utxo.vout, value: r.utxo.value })));
    });

    // Auto-pick the safest viable UTXO. Priority lives in the SDK
    // (findAutoPickCandidate) so ordpool and cat21.space can't drift.
    // Never nulls a live selection on transient empty emissions —
    // that guards against reload-induced signal flap.
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

    // Fee rate → orchestrator. Debounced so a scrub through 1..99
    // doesn't fan out 99 simulations.
    toObservable(this.mintFormData)
      .pipe(map((v) => v.feeRate), debounceTime(150))
      .subscribe((rate) => {
        if (rate && rate > 0) this.orchestrator.setFeeRate(rate);
      });

    // Form value → orchestrator content. Only fires when the form is
    // valid. Debounced so keystrokes don't fan out.
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

    // #12345-style inscription-number lookup — resolve to a full
    // inscription id via ord-proxy on debounce, then patch the field
    // in place. Same shape as the pre-signal-forms mint form.
    for (const key of INSCRIPTION_ID_FIELDS) {
      toObservable(this.mintFormData)
        .pipe(map((v) => v[key]), debounceTime(1000))
        .subscribe((value) => {
          const trimmed = value.trim();
          if (!trimmed || !/^\d+$/.test(trimmed)) return;
          this.mintFacade.lookupInscriptionId(trimmed).subscribe((inscriptionId) => {
            if (!inscriptionId) return;
            this.mintFormData.update((v) => ({ ...v, [key]: inscriptionId }));
          });
        });
    }

    // Initial fee rate on the orchestrator (matches the form default).
    this.orchestrator.setFeeRate(INITIAL_MINT_FORM.feeRate);

    // When a new suggestion arrives from the store, patch its six ids
    // into the form. Uses object identity to detect fresh emissions —
    // NgRx re-emits a new reference on every dispatch of Success.
    let lastSuggestion: unknown = undefined;
    effect(() => {
      const suggestion = this.mintFacade.cubeSuggestion();
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
    const i = this.mintFacade.inscriptions();
    if (!i.itemsPerPage) return;
    const lastPage = Math.ceil(i.totalInscriptions / i.itemsPerPage);
    if (event.key === 'ArrowLeft' && i.currentPage > 1) {
      this.mintFacade.loadInscriptions(i.itemsPerPage, i.currentPage - 1);
    } else if (event.key === 'ArrowRight' && i.currentPage < lastPage) {
      this.mintFacade.loadInscriptions(i.itemsPerPage, i.currentPage + 1);
    }
  }

  connectWallet(type: KnownOrdinalWalletType) {
    // WalletService.connectWallet is a cold observable; the (click)
    // expression doesn't subscribe on its own, so the connect flow
    // never runs unless we call .subscribe() here.
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
    this.mintFacade.loadCubeSuggestion('');
  }

  cancelCheckout() {
    this.checkoutOpen.set(false);
  }

  async mint() {
    if (!this.canMint()) return;

    // Belt-and-braces: sync content one more time in case the Mint
    // click landed before the debounced form-value subscription fired.
    const html = getCubeHtml(this.cubeDetails());
    this.orchestrator.setContent({
      body: new TextEncoder().encode(html),
      contentType: 'text/html;charset=utf-8',
      tip: { address: HAUSHOPPE_TIP_ADDRESS, value: HAUSHOPPE_TIP_SATS },
    });

    try {
      const result = await firstValueFrom(this.orchestrator.mint());
      this.pastFacade.recordPastMint(result.commitTxId, result.revealTxId);
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

const INSCRIPTION_ID_FIELDS = [
  'inscriptionId1',
  'inscriptionId2',
  'inscriptionId3',
  'inscriptionId4',
  'inscriptionId5',
  'inscriptionId6',
] as const;

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
