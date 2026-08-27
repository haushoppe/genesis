import { DatePipe, DecimalPipe, SlicePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, TemplateRef, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { form, max, min, pattern, required, schema, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { NgbModal, NgbModalRef, NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import {
  AUTO_SCAN_MAX_VALUE_SAT,
  bucketOf,
  findAutoPickCandidate,
  getAddressNetwork,
  getDummyKeypair,
  getMinimumUtxoSize,
  InscribeMintOrchestrator,
  Network,
  prepareInscribeFundingInput,
  RecommendedFees,
  simulateInscribeFees,
  SimulateInscribeFeesResult,
  toScureNetwork,
  TxnOutput,
  UtxoContentScanner,
  UtxoScanBucket,
  UtxoScanState,
  validateInscribeOperation,
  WalletService,
} from 'ordpool-sdk';
import { catchError, debounceTime, finalize, firstValueFrom, from, map, Observable, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { CubePreviewComponent } from '../layout/cube-preview/cube-preview.component';
import { CubePreviewTitleComponent } from '../layout/cube-preview/cube-preview-title.component';
import { InscriptionListItemComponent } from '../layout/inscription-list-item/inscription-list-item.component';
import { getCubeHtml, isCubeWarningHtml } from '../services/cube-html';
import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { CubeSuggestionService } from '../services/cubes-data/cube-suggestion.service';
import { formatSats } from '../services/format-sats';
import { InscriptionLookupService } from '../services/inscription-lookup.service';
import { PastMintsService } from '../services/past-mints.service';
import { PriceService } from '../services/price.service';
import { rxResourceFixed } from '../shared/utils/rx-resource-fixed';

/**
 * HAUS HOPPE donation address + amount — the reveal tx's optional
 * vout[1] silently tips this on every mint. No user-facing UI. Comes
 * from environment.ts so regtest e2e specs can override to a
 * bcrt1p… address that doesn't dust-reject on the local chain.
 */
const HAUSHOPPE_TIP_ADDRESS = environment.haushoppeTipAddress;
const HAUSHOPPE_TIP_SATS = environment.haushoppeTipSats;

// ord canonical inscription-id: 64 hex + `i` + non-negative integer
// without leading zeros. `i08262` etc. would 404 on lookup.
const INSCRIPTION_ID_PATTERN = /^[a-f0-9]{64}i(0|[1-9]\d*)$/;

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
  // Reject Infinity (`1e999`) / NaN and cap at the SDK gate's 1000
  // sat/vB ceiling so a fat-fingered rate can't sail past validation
  // (Infinity <= 1000 and NaN <= 1000 both evaluate false).
  max(path.feeRate, 1000);
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
    DatePipe,
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
  private readonly priceService = inject(PriceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly modalService = inject(NgbModal);

  protected readonly autoScanThreshold = AUTO_SCAN_MAX_VALUE_SAT;
  protected readonly feeTiers = FEE_TIERS;
  /** Keys of the six inscription-id form fields, in cube-side order. */
  protected readonly sideKeys = INSCRIPTION_ID_FIELDS;

  // ---------- Async resources ----------

  /** Cursor over the ordinal-cubes-index — one static JSON blob. */
  protected readonly cursorResource = rxResourceFixed({
    stream: () => this.cubesData.getCursor(),
  });

  /**
   * BTC/USD price for the cost readouts. Null on error / regtest.
   * The `priceRefreshTick` params dep drives a 5-minute refetch, so
   * an all-day-tab keeps a fresh rate and a transient first-fetch
   * null clears on the next tick instead of hiding the USD suffix
   * for the whole session.
   */
  private readonly priceRefreshTick = signal(0);
  protected readonly btcUsdResource = rxResourceFixed({
    params: () => ({ tick: this.priceRefreshTick() }),
    stream: () => this.priceService.getBtcUsd(),
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

  /**
   * True when the wallet has UTXOs but none large enough at the
   * current fee rate. Used by the template to auto-open the Advanced
   * <details> that owns the fee-rate control the alert points at.
   */
  protected readonly hasInsufficientFunds = computed(() =>
    this.viableRows().length === 0 &&
    this.orchestrator.state() === 'ready' &&
    this.simulations().length > 0,
  );

  // ---------- Checkout state ----------

  protected readonly checkoutOpen = signal(false);
  protected readonly canOpenCheckout = computed(() => this.mintForm().valid());

  /**
   * Populated when mint() bails on either the Warning-HTML sentinel
   * or the SDK inscribe gate. Rendered as a role=alert red banner in
   * the drawer; clears on the next successful mint attempt.
   */
  protected readonly mintGateError = signal<string | null>(null);

  // ---------- Watch-only (xpub) export/paste signing bridge ----------

  /** The unsigned PSBT shown to the user while a watch-only mint waits.
   *  Null except while the export/paste modal is open. */
  protected readonly psbtUnsigned = signal<{ base64: string; hex: string } | null>(null);
  protected readonly psbtSignedInput = signal('');
  private psbtModalRef: NgbModalRef | undefined;
  private readonly psbtSignTemplate = viewChild.required<TemplateRef<unknown>>('psbtSignModal');

  /**
   * User-facing wallet spend for the auto-picked UTXO — miner fees
   * (commit + reveal) + the 546-sat postage kept as the cube UTXO +
   * the small HAUSHOPPE tip. Everything the wallet debits.
   *
   * `fundingRequirementSats` is the MINIMUM the UTXO must cover; the
   * wallet's actual debit equals `utxo.value - change`, and when
   * `change < dustLimit` the PSBT drops the change output and the
   * wallet signs a debit for the entire UTXO. Report the honest
   * amount the user will see in their wallet prompt.
   */
  protected readonly totalSpendSats = computed<number | null>(() => {
    const row = this.selectedRow();
    if (!row) return null;
    const funding = row.simulation.fundingRequirementSats;
    const utxoValue = row.utxo.value;
    const wallet = this.connectedWallet();
    if (!wallet) return funding;
    const changeMin = getMinimumUtxoSize(wallet.paymentAddress);
    const change = utxoValue - funding;
    return change < changeMin ? utxoValue : funding;
  });

  /** Human-friendly cost line — `"3,000 sat (~$1.85)"` or just `"3,000 sat"`. */
  protected readonly totalSpendLabel = computed<string>(() => {
    const sats = this.totalSpendSats();
    if (sats == null) return '';
    return formatSats(sats, this.btcUsdResource.value() ?? null);
  });

  /** The cube HTML for the current form, memoised so the parseCube
   *  round-trip runs once per cubeDetails change (shared by the
   *  pre-connect cost, the orchestrator body build, and mint()). */
  private readonly cubeHtml = computed<string>(() => getCubeHtml(this.cubeDetails()));

  /** The exact bytes inscribed for the current cube. */
  private readonly cubeBody = computed<Uint8Array>(() => new TextEncoder().encode(this.cubeHtml()));

  /**
   * Constant-derived simulation context: the dummy p2wpkh keypair +
   * synthetic funding input the pre-connect cost sim runs against. It
   * depends only on HAUSHOPPE_TIP_ADDRESS's network, never on any form
   * input, so a dep-free `computed` derives the keypair once (lazily,
   * on first read) and caches it for the component's life instead of
   * re-deriving it on every recompute. A throw here (invalid address)
   * surfaces inside the sim's try/catch below.
   */
  private readonly simContext = computed(() => {
    const network = this.deriveNetwork();
    const dummy = getDummyKeypair(toScureNetwork(network));
    // p2wpkh matches Xverse's payment-address format for new accounts
    // and every other native-segwit-payment wallet we support. Small
    // delta versus p2sh-p2wpkh legacy Xverse.
    const fundingInput = prepareInscribeFundingInput({
      utxo: { txid: 'f'.repeat(64), vout: 0, value: 10_000_000, status: { confirmed: true } },
      paymentPublicKey: dummy.dummyPublicKey,
      paymentAddress: dummy.addressP2WPKH,
      isSimulation: true,
      network,
    });
    return { network, dummy, fundingInput };
  });

  /**
   * Wallet-agnostic mint-cost: runs the SDK's `simulateInscribeFees`
   * against the synthetic Xverse-shaped funding input (see `simContext`)
   * and the ACTUAL cube body (title-varying byte count) at the current
   * fee-rate. Debounced 150 ms so live typing in the title / id / colour
   * fields does not re-run the sim (3 PSBT builds) on every keystroke.
   * The sim + its error logging live in the observable's `map`, not a
   * `computed`, so the derivation stays a pure signal. Shown before the
   * user connects a wallet; once a UTXO is picked, `totalSpendLabel`
   * above takes over with the exact number for the connected wallet's
   * real UTXO.
   */
  protected readonly preConnectMintSats = toSignal(
    toObservable(computed(() => ({
      feeRate: this.mintFormData().feeRate,
      body: this.cubeBody(),
      warn: isCubeWarningHtml(this.cubeHtml()),
    }))).pipe(
      debounceTime(150),
      map(({ feeRate, body, warn }): number | null => {
        // Reject non-finite rates (Infinity from a `1e999` input, NaN) so
        // the Cost line never renders "Infinity sat" / "NaN sat".
        if (warn || !Number.isFinite(feeRate) || feeRate <= 0) return null;
        try {
          const { network, dummy, fundingInput } = this.simContext();
          const sim = simulateInscribeFees({
            feeRatePerVbyte: feeRate,
            body,
            contentType: 'text/html;charset=utf-8',
            fundingInput,
            senderChangeAddress: dummy.addressP2WPKH,
            recipientAddress: dummy.addressP2TR,
            ephemeralPubkeyXonly: dummy.xOnlyDummyPublicKey,
            tip: { address: HAUSHOPPE_TIP_ADDRESS, value: HAUSHOPPE_TIP_SATS },
            network,
          });
          return sim.fundingRequirementSats;
        } catch (err) {
          console.warn('[cubes] pre-connect cost simulation failed', err);
          return null;
        }
      }),
    ),
    { initialValue: null },
  );
  protected readonly preConnectMintLabel = computed<string>(() => {
    const sats = this.preConnectMintSats();
    if (sats == null) return '';
    return formatSats(sats, this.btcUsdResource.value() ?? null);
  });

  /** Short middle-ellipsis form of the connected payment address. */
  protected readonly connectedAddressShort = computed<string>(() => {
    const addr = this.connectedWallet()?.paymentAddress ?? '';
    return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
  });

  /** True while the user has clicked Mint but the connect flow hasn't
   *  completed yet. Set by `startCheckout()` when no wallet is connected;
   *  cleared by an effect below the moment a wallet arrives, which then
   *  opens the drawer automatically. */
  private readonly pendingCheckout = signal(false);

  // ---------- Constructor: reactive wiring ----------

  private lastWalletAddress: string | null = null;

  constructor() {
    // Nudge the BTC/USD price every 5 min. Bare `rxResourceFixed` fires
    // its stream once per params-change; without this heartbeat the
    // rate goes stale on a long-lived tab, and a first-fetch null
    // hides the USD suffix for the rest of the session.
    const priceIntervalId = setInterval(() => {
      this.priceRefreshTick.update((n) => n + 1);
    }, 5 * 60 * 1000);
    this.destroyRef.onDestroy(() => clearInterval(priceIntervalId));

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
        // Only forward finite, positive rates: an Infinity/NaN feeRate would
        // make every UTXO's fundingRequirementSats Infinity, tripping a false
        // "insufficient funds" alert. The form's max(1000) validator disables
        // Mint for such a rate; this keeps the orchestrator sim clean too.
        if (Number.isFinite(v.feeRate) && v.feeRate > 0) this.orchestrator.setFeeRate(v.feeRate);
        if (!this.mintForm().valid()) return;
        this.orchestrator.setContent({
          body: this.cubeBody(),
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
    // Two guards, both via untracked() so the effect only re-runs when
    // the suggestion itself changes:
    //  - checkoutOpen: don't clobber the cube the user is about to mint
    //  - anyFilled: don't clobber user-entered inscription IDs. This is
    //    the race the alby E2E hit — page-load slower than usual, so
    //    suggestion resolved DURING the test's fill sequence and
    //    overwrote already-typed sides. Suggestions apply only to a
    //    still-blank form; craftAnotherCube() clears the form first.
    effect(() => {
      const suggestion = this.suggestionResource.value();
      if (!suggestion) return;
      if (untracked(() => this.checkoutOpen())) return;
      const current = untracked(() => this.mintFormData());
      const anyFilled = INSCRIPTION_ID_FIELDS.some((k) => current[k]);
      if (anyFilled) return;
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
    // Close the drawer + clear the six sides so the suggestion-effect
    // guard sees an empty form and applies the new suggestion when
    // reload() resolves. Without the clear the anyFilled guard would
    // skip forever after the first suggestion. Also the click handler
    // for the shuffle anchors — their routerLink navigates + fragment
    // holds viewport; this reload re-emits for the new collection.
    this.checkoutOpen.set(false);
    this.mintFormData.update((v) => ({
      ...v,
      inscriptionId1: '',
      inscriptionId2: '',
      inscriptionId3: '',
      inscriptionId4: '',
      inscriptionId5: '',
      inscriptionId6: '',
    }));
    this.suggestionResource.reload();
  }

  cancelCheckout() {
    this.checkoutOpen.set(false);
  }

  /**
   * The watch-only signing bridge. `InscribeMintOrchestrator.mint()` invokes
   * this only for a watch-only (xpub) wallet: it hands us the commit's
   * unsigned PSBT, we open the export/paste modal, and resolve with the
   * user's signed PSBT (base64 or hex). Injected browser wallets never call
   * it, so passing it unconditionally is safe. The SDK finalizes +
   * broadcasts whatever comes back.
   */
  private readonly psbtPrompt = (unsigned: { base64: string; hex: string }): Observable<string> => {
    this.psbtUnsigned.set(unsigned);
    this.psbtSignedInput.set('');
    const ref = this.modalService.open(this.psbtSignTemplate(), {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      ariaLabelledBy: 'watch-only-sign-title',
    });
    this.psbtModalRef = ref;
    return from(ref.result).pipe(
      map((signed) => (typeof signed === 'string' ? signed.trim() : '')),
      // Dismiss (Cancel / X) rejects the modal result; turn that into a
      // clean cancel error instead of leaking an ng-bootstrap reason.
      catchError(() => throwError(() => new Error('Watch-only signing was cancelled.'))),
      finalize(() => { this.psbtModalRef = undefined; this.psbtUnsigned.set(null); }),
    );
  };

  submitSignedPsbt() {
    const signed = this.psbtSignedInput().trim();
    if (!signed) return;
    this.psbtModalRef?.close(signed);
  }

  cancelSignedPsbt() {
    this.psbtModalRef?.dismiss();
  }

  setSignedPsbtInput(value: string) {
    this.psbtSignedInput.set(value);
  }

  copyUnsignedPsbt() {
    const unsigned = this.psbtUnsigned();
    if (!unsigned || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(unsigned.base64).catch(() => {/* ignore */});
  }

  downloadUnsignedPsbt() {
    const unsigned = this.psbtUnsigned();
    if (!unsigned || typeof document === 'undefined') return;
    // Decode the base64 PSBT to its raw bytes so the download is a real
    // binary .psbt file (what Sparrow / Electrum "Open PSBT file" expect).
    const bytes = Uint8Array.from(atob(unsigned.base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'cube-inscribe-unsigned.psbt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async mint() {
    if (!this.canMint()) return;
    const wallet = this.connectedWallet();
    if (!wallet) return;

    // Belt-and-braces: sync content one more time in case the Mint click
    // landed before the debounced form-value subscription fired.
    const html = this.cubeHtml();
    const body = this.cubeBody();

    // Guard 1: cubeHtml refuses to build past parseCube. Never let the
    // red Warning fallback land as an on-chain inscription — the user
    // pays for whatever bytes we sign, and a broken red page is
    // permanent. Belt-and-braces on top of the global entity escape.
    if (isCubeWarningHtml(html)) {
      this.mintGateError.set('The cube data would produce an invalid inscription. Try a simpler title.');
      return;
    }

    // Guard 2: SDK inscribe gate. Cubes is the pilot inscribe consumer
    // and sets the pattern for every future one — the same gate cat21's
    // orchestrators use, adapted for the inscribe surface. Pins tip
    // address to HAUSHOPPE, enforces mainnet on prod builds, caps the
    // tip so a bugged feeRate can't drain the wallet.
    const gate = validateInscribeOperation({
      config: {
        network: this.deriveNetwork(),
        allowedTipAddresses: [HAUSHOPPE_TIP_ADDRESS],
        maxTipValueSats: 100_000,
        maxFeeRatePerVbyte: 1000,
        // Skip the SDK's self-send check when the wallet uses ONE
        // address for both payment + ordinals (Unisat/Wizz/OKX). For
        // those wallets `wallet.paymentAddress === wallet.ordinalsAddress`
        // is by design, not an accidental self-send — the gate's
        // recipient-equals-ownPaymentAddress check would refuse every
        // legitimate mint. Dual-address wallets keep the guard.
        ownPaymentAddress: wallet.paymentAddress === wallet.ordinalsAddress
          ? undefined
          : wallet.paymentAddress,
      },
      operation: {
        kind: 'inscribe',
        intent: {
          recipient: wallet.ordinalsAddress,
          feeRate: this.mintFormData().feeRate,
          body,
          contentType: 'text/html;charset=utf-8',
          tip: { address: HAUSHOPPE_TIP_ADDRESS, value: HAUSHOPPE_TIP_SATS },
        },
      },
    });
    if (!gate.ok) {
      this.mintGateError.set(
        `Mint refused (${gate.reason}${gate.detail ? ': ' + gate.detail : ''}). ` +
        `This is a safety check — please report if you were minting a normal cube.`,
      );
      // eslint-disable-next-line no-console
      console.warn('[cubes] mint gate rejected:', gate.reason, gate.detail);
      return;
    }
    this.mintGateError.set(null);

    this.orchestrator.setContent({
      body,
      contentType: 'text/html;charset=utf-8',
      tip: { address: HAUSHOPPE_TIP_ADDRESS, value: HAUSHOPPE_TIP_SATS },
    });

    try {
      const result = await firstValueFrom(this.orchestrator.mint(this.psbtPrompt));
      const form = this.mintFormData();
      const inscriptionIds = INSCRIPTION_ID_FIELDS.map((k) => form[k]);
      this.pastMints.record(result.commitTxId, result.revealTxId, inscriptionIds);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[cubes] mint threw:', err);
    }
  }

  /**
   * Map the environment's own tip-address network onto the SDK's
   * `Network` enum. Regtest env → Network.Regtest; mainnet env →
   * Network.Mainnet. The tip address is the single source of truth
   * for network context — main.ts already asserts mainnet at boot
   * for prod builds, so this can never return a wrong value in prod.
   */
  private deriveNetwork(): Network {
    const group = getAddressNetwork(HAUSHOPPE_TIP_ADDRESS);
    switch (group) {
      case 'mainnet': return Network.Mainnet;
      case 'regtest': return Network.Regtest;
      case 'testnet': return Network.Testnet3;
      // Fail loudly if the SDK's AddressNetworkGroup union ever widens
      // (e.g. a distinct signet/testnet4) instead of leaking undefined
      // into toScureNetwork / the signing path.
      default: throw new Error(`Unhandled address network group: ${group}`);
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
    // Actively pull a fresh cube. The just-minted IDs are already in
    // PastMintsService and the CubeSuggestionService unions them into
    // its claimed set, so the new suggestion never picks any of them.
    this.suggestionResource.reload();
  }
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
