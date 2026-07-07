import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { InscribeContent, InscribeMintOrchestrator, InscribeUtxoSimulation, TxnOutput, WalletService } from 'ordpool-sdk';
import { debounceTime, firstValueFrom } from 'rxjs';

import { InscriptionListItemComponent } from '../layout/inscription-list-item/inscription-list-item.component';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { getCubeHtml } from '../services/cube-html';
import { MintFacade } from '../store/mint.facade';
import { CubeDetails } from '../store/mint.actions';
import { PastFacade } from '../store/past.facade';
import { TrimNumberValueAccessorDirective } from '../trim-number-value-accessor.directive';
import { TrimValueAccessorDirective } from '../trim-value-accessor.directive';
import { InscriptionIdValidator } from './mint-form/inscription-id.validator';

/**
 * HAUS HOPPE donation address — the reveal tx's optional vout[1]
 * silently tips this address on every mint. No user-facing UI;
 * users pay one fee, we take a small slice as revenue. Same posture
 * as the retired OrdinalsBot referral kickback.
 */
const HAUSHOPPE_TIP_ADDRESS = '???';

/**
 * Silent tip amount in sats. Small enough that a user reading the
 * mempool tx wouldn't blink; large enough to matter in aggregate.
 * A future signal-driven "your tip rate" setting could scale this
 * with fee rate; for the MVP a flat value keeps the math obvious.
 */
const HAUSHOPPE_TIP_SATS = 1000;

/**
 * String test — pure digits mean the user typed a blessed
 * inscription number like `#12345` and expects a lookup.
 */
function containsOnlyNumbers(str: string): boolean {
  return /^\d+$/.test(str);
}

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
  imports: [
    LoadingIndicatorComponent,
    InscriptionListItemComponent,
    NgbPagination,
    RouterLink,
    ReactiveFormsModule,
    DecimalPipe,
    TrimValueAccessorDirective,
    TrimNumberValueAccessorDirective,
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
  cd = inject(ChangeDetectorRef);
  cubesData = inject(CubesDataService);

  cursor = toSignal(this.cubesData.getCursor());
  connectedWallet = toSignal(this.walletService.connectedWallet$, { initialValue: null });
  wallets = toSignal(this.walletService.wallets$, {
    initialValue: { installedWallets: [], notInstalledWallets: [] },
  });
  simulations = toSignal(this.orchestrator.simulations$, { initialValue: [] as InscribeUtxoSimulation[] });

  // Present every installed ordinals wallet as a connect option.
  // The SDK's connectWallet() rejects wallets whose signer can't
  // inscribe; the picker itself doesn't currently expose
  // `signingSupported` on the wallet metadata (only on connectors
  // internally). Follow-up: expose it upstream and filter here.
  installedOrdinalsAware = computed(() => this.wallets().installedWallets);

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

  private getCubeDetails(): CubeDetails {
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

  /**
   * Pick a UTXO to fund the mint. Expert mode leaves the choice to
   * the user; default just picks the biggest confirmed viable UTXO.
   * Asset-scanning (like ordpool cat21-mint's bucket priority) is
   * a follow-up — for MVP we accept the simplification and warn
   * users to keep asset-bearing UTXOs elsewhere.
   */
  autoPickUtxo(): TxnOutput | null {
    const viable = this.simulations().filter((r) => !r.insufficient && r.simulation);
    if (!viable.length) return null;
    const sorted = [...viable].sort((a, b) => b.utxo.value - a.utxo.value);
    return sorted[0]?.utxo ?? null;
  }

  async mint() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const wallet = this.connectedWallet();
    if (!wallet) return;

    const cubeDetails = this.getCubeDetails();
    const html = getCubeHtml(cubeDetails);
    const body = new TextEncoder().encode(html);

    const content: InscribeContent = {
      body,
      contentType: 'text/html;charset=utf-8',
      tip: { address: HAUSHOPPE_TIP_ADDRESS, value: HAUSHOPPE_TIP_SATS },
    };
    this.orchestrator.setContent(content);

    // Give simulations$ a tick to recompute against the new body
    // (feeRate + content are both set now). Then auto-pick unless
    // expert mode already set one.
    await Promise.resolve();
    if (!this.orchestrator.selectedUtxo()) {
      const picked = this.autoPickUtxo();
      if (!picked) return;
      this.orchestrator.setSelectedUtxo(picked);
    }

    try {
      const result = await firstValueFrom(this.orchestrator.mint());
      this.pastFacade.recordPastMint(result.commitTxId, result.revealTxId);
      this.cd.detectChanges();
    } catch {
      // Orchestrator has already set errorMessage; template renders it.
      this.cd.detectChanges();
    }
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
