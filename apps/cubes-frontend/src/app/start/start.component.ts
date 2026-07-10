import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import {
  AUTO_SCAN_MAX_VALUE_SAT,
  bucketOf,
  findAutoPickCandidate,
  InscribeContent,
  InscribeMintOrchestrator,
  InscribeUtxoSimulation,
  KnownOrdinalWalletType,
  RecommendedFees,
  SimulateInscribeFeesResult,
  TxnOutput,
  UtxoContentScanner,
  UtxoScanBucket,
  UtxoScanState,
  WalletService,
} from 'ordpool-sdk';
import { combineLatest, debounceTime, firstValueFrom, map, tap } from 'rxjs';

import { CubePreviewComponent } from '../layout/cube-preview/cube-preview.component';
import { InscriptionListItemComponent } from '../layout/inscription-list-item/inscription-list-item.component';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { getCubeHtml } from '../services/cube-html';
import { MintFacade } from '../store/mint.facade';
import { CubeDetails } from '../store/mint.actions';
import { PastFacade } from '../store/past.facade';
import { environment } from '../../environments/environment';
import { InscriptionIdValidator } from './mint-form/inscription-id.validator';

/**
 * HAUS HOPPE donation address + amount — the reveal tx's optional
 * vout[1] silently tips this on every mint. No user-facing UI. Comes
 * from environment.ts so regtest e2e specs can override to a
 * bcrt1p… address that doesn't dust-reject on the local chain.
 */
const HAUSHOPPE_TIP_ADDRESS = environment.haushoppeTipAddress;
const HAUSHOPPE_TIP_SATS = environment.haushoppeTipSats;

/**
 * String test — pure digits mean the user typed a blessed
 * inscription number like `#12345` and expects a lookup.
 */
function containsOnlyNumbers(str: string): boolean {
  return /^\d+$/.test(str);
}

/**
 * One expert-panel row: the raw simulation, plus the scanner's view
 * of what (if anything) lives on the UTXO.
 */
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
  imports: [
    LoadingIndicatorComponent,
    InscriptionListItemComponent,
    CubePreviewComponent,
    NgbPagination,
    RouterLink,
    ReactiveFormsModule,
    DecimalPipe,
    SlicePipe,
  ],
  host: {
    '(window:keydown)': 'onKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartComponent implements OnInit {
  mintFacade = inject(MintFacade);
  pastFacade = inject(PastFacade);
  walletService = inject(WalletService);
  orchestrator = inject(InscribeMintOrchestrator);
  scanner = inject(UtxoContentScanner);
  cd = inject(ChangeDetectorRef);
  cubesData = inject(CubesDataService);

  readonly autoScanThreshold = AUTO_SCAN_MAX_VALUE_SAT;

  cursor = toSignal(this.cubesData.getCursor());
  connectedWallet = toSignal(this.walletService.connectedWallet$, { initialValue: null });
  wallets = toSignal(this.walletService.wallets$, {
    initialValue: { installedWallets: [], notInstalledWallets: [] },
  });
  simulations = toSignal(this.orchestrator.simulations$, { initialValue: [] as InscribeUtxoSimulation[] });
  recommendedFees = toSignal(this.orchestrator.recommendedFees$, { initialValue: null as RecommendedFees | null });

  /**
   * Combines the orchestrator's raw simulation rows with the scanner's
   * asset-scan state, mirroring ordpool cat21-mint's `paymentOutputs$`.
   * Filters to viable rows, sorts biggest-first, caps at 10, and
   * enriches each with a bucket (clean / assets / unscanned / …).
   * Side effect on tap: eager-scan small UTXOs and auto-pick the
   * safest row when the user hasn't overridden.
   */
  paymentOutputs$ = combineLatest([
    this.orchestrator.simulations$,
    this.scanner.states$,
  ]).pipe(
    map(([rows, scanMap]): ViableInscribeSimulation[] => {
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
    }),
    tap((rows) => {
      // eslint-disable-next-line no-console
      console.error('[cubes:paymentOutputs$] emit rows=' + rows.length + ' buckets=' + rows.map((r) => r.bucket).join(','));
      // Eager-scan small UTXOs; the scanner dedupes by outpoint so
      // repeat emissions cost nothing.
      this.scanner.autoScan(rows.map((r) => ({
        txid: r.utxo.txid,
        vout: r.utxo.vout,
        value: r.utxo.value,
      })));

      // Auto-pick the safest row unless the user's current pick is
      // still viable. Bucket priority: clean → unscanned → failed.
      // Never auto-pick 'assets' — that requires an explicit
      // "Use anyway" click.
      if (!rows.length) {
        this.orchestrator.setSelectedUtxo(null);
        return;
      }
      const current = this.orchestrator.selectedUtxo();
      const stillThere = current && rows.find((r) =>
        r.utxo.txid === current.txid && r.utxo.vout === current.vout,
      );
      if (stillThere) return;
      const next = findAutoPickCandidate(rows);
      // eslint-disable-next-line no-console
      console.error('[cubes:paymentOutputs$] auto-pick=' + (next ? next.utxo.txid.slice(0, 8) : 'null'));
      this.orchestrator.setSelectedUtxo(next?.utxo ?? null);
    }),
  );

  paymentOutputs = toSignal(this.paymentOutputs$, { initialValue: [] as ViableInscribeSimulation[] });

  // Diagnostic: log every transition of the paymentOutputs signal. If the
  // signal ever transitions to non-empty but the tap in paymentOutputs$
  // never emitted rows>0, that proves the signal is being written by
  // something other than the toSignal subscription.
  private _paymentOutputsWatcher = effect(() => {
    const len = this.paymentOutputs().length;
    const simLen = this.simulations().length;
    // eslint-disable-next-line no-console
    console.error('[cubes:signal] paymentOutputs.length=' + len + ' simulations.length=' + simLen);
  });

  // Present every installed on-chain ordinals wallet as a connect
  // option. `onChainOrdinals: false` is set upstream on wallets
  // that detect but can't hold ordinal artifacts (Lightning-only
  // Alby with no BTC backend, etc.); those get filtered out here
  // so the picker only shows options that can actually complete
  // a cube mint.
  installedOrdinalsAware = computed(() =>
    this.wallets().installedWallets.filter((w) => w.onChainOrdinals !== false),
  );

  expertMode = signal(false);

  form = new FormGroup({
    inscriptionId1: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId2: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId3: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId4: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId5: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId6: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    title: new FormControl('', { nonNullable: true }),
    rotationSpeedX: new FormControl('', { nonNullable: true }),
    rotationSpeedY: new FormControl('', { nonNullable: true }),
    colorPane: new FormControl('', { nonNullable: true }),
    bgColor1: new FormControl('', { nonNullable: true }),
    bgColor2: new FormControl('', { nonNullable: true }),
    feeRate: new FormControl<number | null>(10, { validators: [Validators.required, Validators.min(1)] }),
  });

  c = this.form.controls;

  ngOnInit() {
    // Reset the scanner's cache when the wallet changes — new
    // wallet, new UTXOs, no reason to hold on to old scan state.
    let lastWalletAddress: string | null = null;
    this.walletService.connectedWallet$.subscribe((w) => {
      const addr = w?.ordinalsAddress ?? null;
      if (lastWalletAddress !== null && addr !== lastWalletAddress) {
        this.scanner.reset();
      }
      lastWalletAddress = addr;
    });

    // Each inscription ID field: if the user types `#12345`-style
    // digits, resolve via ord-proxy in the background and swap the
    // field to the resolved id. Same shape as the retired mint-form.
    (['inscriptionId1', 'inscriptionId2', 'inscriptionId3', 'inscriptionId4', 'inscriptionId5', 'inscriptionId6'] as const).forEach((key) => {
      this.c[key].valueChanges.pipe(debounceTime(1000)).subscribe((value) => {
        if (!value) return;
        const trimmed = value.trim();
        if (!containsOnlyNumbers(trimmed)) return;
        this.mintFacade.lookupInscriptionId(trimmed).subscribe((inscriptionId) => {
          if (inscriptionId) {
            this.c[key].setValue(inscriptionId);
            this.cd.detectChanges();
          }
        });
      });
    });

    // Fee-rate changes flow into the orchestrator; simulations$
    // depends on it.
    this.c.feeRate.valueChanges.subscribe((rate) => {
      if (rate && rate > 0) this.orchestrator.setFeeRate(rate);
    });
    if (this.c.feeRate.value) this.orchestrator.setFeeRate(this.c.feeRate.value);

    // Live cube preview + orchestrator content — re-sync whenever
    // any form field changes so:
    //  1. iframe preview rerenders,
    //  2. orchestrator.simulations$ recomputes fees against the
    //     current body size,
    //  3. auto-pick fires + Mint button enables.
    // Without wiring setContent here the button stayed permanently
    // disabled — simulations$ short-circuited on null content, no
    // UTXO auto-selected, [disabled]="!selected" pinned true forever.
    this.form.valueChanges.pipe(debounceTime(150)).subscribe(() => {
      const details = this.getCubeDetails();
      this.cubeDetails.set(details);
      if (this.form.valid) {
        const html = getCubeHtml(details);
        this.orchestrator.setContent({
          body: new TextEncoder().encode(html),
          contentType: 'text/html;charset=utf-8',
          tip: { address: HAUSHOPPE_TIP_ADDRESS, value: HAUSHOPPE_TIP_SATS },
        });
      }
    });
  }

  onKeydown(event: KeyboardEvent) {
    if (isTextInputTarget(event.target)) return;
    const i = this.mintFacade.inscriptions();
    if (!i?.itemsPerPage) return;
    const lastPage = Math.ceil(i.totalInscriptions / i.itemsPerPage);
    if (event.key === 'ArrowLeft' && i.currentPage > 1) {
      this.mintFacade.loadInscriptions(i.itemsPerPage, i.currentPage - 1);
    } else if (event.key === 'ArrowRight' && i.currentPage < lastPage) {
      this.mintFacade.loadInscriptions(i.itemsPerPage, i.currentPage + 1);
    }
  }

  cubeDetails = signal<CubeDetails>({
    inscriptionIds: { inscriptionId1: '', inscriptionId2: '', inscriptionId3: '', inscriptionId4: '', inscriptionId5: '', inscriptionId6: '' },
    title: '', rotationSpeedX: '', rotationSpeedY: '', colorPane: '', bgColor1: '', bgColor2: '',
  });

  getCubeDetails(): CubeDetails {
    const v = this.form.value;
    return {
      inscriptionIds: {
        inscriptionId1: v.inscriptionId1 || '',
        inscriptionId2: v.inscriptionId2 || '',
        inscriptionId3: v.inscriptionId3 || '',
        inscriptionId4: v.inscriptionId4 || '',
        inscriptionId5: v.inscriptionId5 || '',
        inscriptionId6: v.inscriptionId6 || '',
      },
      title: v.title || '',
      rotationSpeedX: v.rotationSpeedX || '',
      rotationSpeedY: v.rotationSpeedY || '',
      colorPane: v.colorPane || '',
      bgColor1: v.bgColor1 || '',
      bgColor2: v.bgColor2 || '',
    };
  }

  async mint() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const wallet = this.connectedWallet();
    if (!wallet) return;
    if (!this.orchestrator.selectedUtxo()) return;

    // Content is already set by the form.valueChanges subscription
    // above — re-set here as a belt-and-suspenders guard against the
    // Mint click landing before the last debounced valueChanges fires.
    const cubeDetails = this.getCubeDetails();
    const html = getCubeHtml(cubeDetails);
    this.orchestrator.setContent({
      body: new TextEncoder().encode(html),
      contentType: 'text/html;charset=utf-8',
      tip: { address: HAUSHOPPE_TIP_ADDRESS, value: HAUSHOPPE_TIP_SATS },
    });

    try {
      const result = await firstValueFrom(this.orchestrator.mint());
      this.pastFacade.recordPastMint(result.commitTxId, result.revealTxId);
      this.cd.detectChanges();
    } catch {
      // Orchestrator has already set errorMessage; template renders it.
      this.cd.detectChanges();
    }
  }

  /**
   * Triggered by the "Scan" link on unscanned rows in the expert
   * panel. Adds the outpoint to the scanner's active queue.
   */
  scanUtxo(utxo: TxnOutput) {
    this.scanner.scan(`${utxo.txid}:${utxo.vout}`).subscribe();
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

  setFeePreset(rate: number) {
    this.form.controls.feeRate.setValue(rate);
    this.orchestrator.setFeeRate(rate);
  }

  /**
   * Wallet-connect click handler. WalletService.connectWallet returns
   * a cold Observable — the template-level `(click)` expression
   * doesn't subscribe on its own, so the connect flow never runs
   * unless we call `.subscribe()` here. This was a real bug that
   * broke wallet connect end-to-end for every wallet in the picker.
   */
  connectWallet(type: KnownOrdinalWalletType) {
    this.walletService.connectWallet(type).subscribe({
      error: (err) => {
        // eslint-disable-next-line no-console
        console.warn('[cubes] connect failed', type, err);
      },
    });
  }

  mintAnother() {
    this.orchestrator.reset();
    this.form.reset({
      inscriptionId1: '', inscriptionId2: '', inscriptionId3: '',
      inscriptionId4: '', inscriptionId5: '', inscriptionId6: '',
      title: '', rotationSpeedX: '', rotationSpeedY: '',
      colorPane: '', bgColor1: '', bgColor2: '',
      feeRate: 10,
    });
    if (this.c.feeRate.value) this.orchestrator.setFeeRate(this.c.feeRate.value);
  }
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
