import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the environment BEFORE importing StartComponent: the default env's
// tip address is the '???' placeholder, which makes deriveNetwork() throw.
// A real regtest tip lets the mint gate resolve so mint() can reach the
// orchestrator call under test.
vi.mock('../../environments/environment', () => ({
  environment: {
    production: false,
    api: 'http://localhost:3333',
    mempoolApiUrl: '',
    haushoppeTipAddress: 'bcrt1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqvg32hk',
    haushoppeTipSats: 1000,
    ordinalsExplorerIframe: '',
    ordinalsExplorerDetails: '',
    satflowMarketplace: '',
    ordNetMarketplace: '',
  },
}));

import {
  getDummyKeypair, InscribeMintOrchestrator, KnownOrdinalWalletType, Network,
  toScureNetwork, UtxoContentScanner, WalletService,
} from 'ordpool-sdk';
import { hex } from '@scure/base';
import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { CubeSuggestionService } from '../services/cubes-data/cube-suggestion.service';
import { InscriptionLookupService } from '../services/inscription-lookup.service';
import { PastMintsService } from '../services/past-mints.service';
import { PriceService } from '../services/price.service';
import { StartComponent } from './start.component';

/**
 * Constructs the real StartComponent class through DI (no template render)
 * and pins the watch-only mint wiring: mint() threads the component's
 * `psbtPrompt` callback to InscribeMintOrchestrator.mint(), and the export
 * modal's submit closes with the trimmed pasted PSBT. The PSBT resolution
 * itself is unit-tested in watch-only-sign-bridge.
 */
describe('StartComponent: watch-only mint wiring', () => {
  const VALID_ID = `${'a'.repeat(64)}i0`;
  const dummy = getDummyKeypair(toScureNetwork(Network.Regtest));
  const walletAddress = dummy.addressP2TR; // valid bcrt1p (regtest taproot)
  const fakeUtxo = { txid: 'b'.repeat(64), vout: 0, value: 500_000, status: { confirmed: true } };

  let orchestrator: {
    simulations$: BehaviorSubject<unknown[]>;
    recommendedFees$: BehaviorSubject<unknown>;
    fundingRecommendation$: BehaviorSubject<unknown>;
    selectedUtxo: ReturnType<typeof signal>;
    state: ReturnType<typeof signal>;
    setFeeRate: ReturnType<typeof vi.fn>;
    setContent: ReturnType<typeof vi.fn>;
    setSelectedUtxo: ReturnType<typeof vi.fn>;
    mint: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };
  let pastMintsRecord: ReturnType<typeof vi.fn>;
  let component: StartComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();

    orchestrator = {
      simulations$: new BehaviorSubject<unknown[]>([
        { utxo: fakeUtxo, simulation: { fundingRequirementSats: 3000 }, insufficient: false },
      ]),
      recommendedFees$: new BehaviorSubject<unknown>(null),
      fundingRecommendation$: new BehaviorSubject<unknown>({ status: 'auto', recommended: fakeUtxo, candidates: [fakeUtxo] }),
      selectedUtxo: signal<unknown>(fakeUtxo),
      state: signal<string>('ready'),
      setFeeRate: vi.fn(),
      setContent: vi.fn(),
      setSelectedUtxo: vi.fn(),
      mint: vi.fn(() => of({ commitTxId: 'commit', revealTxId: 'reveal' })),
      reset: vi.fn(),
    };
    pastMintsRecord = vi.fn();

    const wallet = {
      type: KnownOrdinalWalletType.xpub,
      ordinalsAddress: walletAddress,
      paymentAddress: walletAddress,
      paymentPublicKey: hex.encode(dummy.dummyPublicKey),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: NgbModal, useValue: { open: vi.fn() } },
        {
          provide: WalletService,
          useValue: { connectedWallet$: new BehaviorSubject<unknown>(wallet), requestWalletConnect: vi.fn() },
        },
        { provide: InscribeMintOrchestrator, useValue: orchestrator },
        { provide: UtxoContentScanner, useValue: { states$: new BehaviorSubject(new Map()), autoScan: vi.fn(), reset: vi.fn(), scan: vi.fn(() => of(undefined)) } },
        { provide: CubesDataService, useValue: { getCursor: () => of({}), getInscriptions: () => of({ inscriptions: [], totalInscriptions: 0, currentPage: 1, itemsPerPage: 12 }) } },
        { provide: CubeSuggestionService, useValue: { getCubeSuggestion: () => of(null) } },
        { provide: InscriptionLookupService, useValue: { lookupById: () => of(null) } },
        { provide: PriceService, useValue: { getBtcUsd: () => of(null) } },
        { provide: PastMintsService, useValue: { record: pastMintsRecord } },
      ],
    });

    component = TestBed.runInInjectionContext(() => new StartComponent());

    // Drive the form to a valid state so canMint() is satisfied.
    (component as unknown as { mintFormData: { set(v: unknown): void } }).mintFormData.set({
      inscriptionId1: VALID_ID, inscriptionId2: VALID_ID, inscriptionId3: VALID_ID,
      inscriptionId4: VALID_ID, inscriptionId5: VALID_ID, inscriptionId6: VALID_ID,
      title: '', rotationSpeedX: '', rotationSpeedY: '', colorPane: '', bgColor1: '', bgColor2: '',
      feeRate: 10,
    });
  });

  it('threads the psbtPrompt callback into InscribeMintOrchestrator.mint()', async () => {
    await component.mint();

    expect(orchestrator.mint).toHaveBeenCalledTimes(1);
    // The exact callback field is forwarded (identity), and it is a function.
    const promptArg = orchestrator.mint.mock.calls[0][0];
    expect(typeof promptArg).toBe('function');
    expect(promptArg).toBe((component as unknown as { psbtPrompt: unknown }).psbtPrompt);
    expect(pastMintsRecord).toHaveBeenCalledTimes(1);
  });

  it('submitSignedPsbt closes the export modal with the trimmed pasted PSBT', () => {
    const close = vi.fn();
    (component as unknown as { psbtModalRef: unknown }).psbtModalRef = { close, dismiss: vi.fn() };
    component.setSignedPsbtInput('  cHNidP8BAHECpasted  ');

    component.submitSignedPsbt();

    expect(close).toHaveBeenCalledWith('cHNidP8BAHECpasted');
  });

  it('rejects a non-finite or over-ceiling feeRate (guards the SDK 1000 sat/vB gate)', () => {
    const c = component as unknown as {
      mintForm: () => { valid(): boolean };
      mintFormData: { set(v: unknown): void };
    };
    const setFee = (feeRate: number) => c.mintFormData.set({
      inscriptionId1: VALID_ID, inscriptionId2: VALID_ID, inscriptionId3: VALID_ID,
      inscriptionId4: VALID_ID, inscriptionId5: VALID_ID, inscriptionId6: VALID_ID,
      title: '', rotationSpeedX: '', rotationSpeedY: '', colorPane: '', bgColor1: '', bgColor2: '',
      feeRate,
    });
    setFee(10);
    expect(c.mintForm().valid()).toBe(true);
    setFee(1001);
    expect(c.mintForm().valid()).toBe(false);
    setFee(Infinity);
    expect(c.mintForm().valid()).toBe(false);
  });

  it('drives the gate off the EFFECTIVE funding coin: manual pick, then the safe auto-pick fallback', () => {
    const c = component as unknown as { selectedRow(): unknown };
    // The orchestrator mock has a viable sim + a manual selectedUtxo → a row is selected.
    expect(c.selectedRow()).not.toBeNull();

    // Clearing the manual pick does NOT reopen the estimate: the funding
    // recommendation still auto-picks a content-clean coin, so the effective
    // coin (and its row) stays resolved. This is the footgun fix in action.
    orchestrator.selectedUtxo.set(null);
    expect(c.selectedRow()).not.toBeNull();

    // Only when there's no manual pick AND nothing safe to auto-pick
    // (recommendation is expert-required: solely asset-bearing coins cover)
    // does the row clear, so the pre-connect estimate reappears.
    orchestrator.fundingRecommendation$.next({ status: 'expert-required', recommended: null, candidates: [fakeUtxo] });
    expect(c.selectedRow()).toBeNull();
  });
});
