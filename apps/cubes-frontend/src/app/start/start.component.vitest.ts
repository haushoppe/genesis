import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the environment BEFORE importing StartComponent: the default env's
// tip address is the '???' placeholder, which makes deriveNetwork() throw.
// A real regtest tip lets the mint gate resolve so mint() can reach the
// orchestrator call under test. The two ord URLs feed the orchestrator's
// scan port (classifyOutpoint); the tests never trigger a real scan.
vi.mock('../../environments/environment', () => ({
  environment: {
    production: false,
    api: 'http://localhost:3333',
    mempoolApiUrl: '',
    ordApiUrl: 'http://localhost:8082',
    cat21OrdApiUrl: 'http://localhost:8082',
    haushoppeTipAddress: 'bcrt1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqvg32hk',
    haushoppeTipSats: 1000,
    ordinalsExplorerIframe: '',
    ordinalsExplorerDetails: '',
    satflowMarketplace: '',
    ordNetMarketplace: '',
  },
}));

import {
  Cat21Service, getDummyKeypair, InscribeSnapshot, KnownOrdinalWalletType, Network,
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
 * Constructs the real StartComponent class through DI (no template render).
 * The orchestrator is now a plain SDK class the component CONSTRUCTS with our
 * ports (Cat21Service getUtxos/postTransaction, classifyOutpoint scan) and
 * mirrors into a `snap` signal — so we mock the ports, neutralize the real
 * orchestrator's setters (so they don't re-emit and clobber the snapshot we
 * drive), and either spy `orch.mint` or set `snap` directly.
 *
 * Pins the watch-only mint wiring: mint() threads the component's `psbtPrompt`
 * callback to the orchestrator's mint(). The PSBT resolution itself is
 * unit-tested in watch-only-sign-bridge.
 */
describe('StartComponent: watch-only mint wiring', () => {
  const VALID_ID = `${'a'.repeat(64)}i0`;
  const dummy = getDummyKeypair(toScureNetwork(Network.Regtest));
  const walletAddress = dummy.addressP2TR; // valid bcrt1p (regtest taproot)
  const fakeUtxo = { txid: 'b'.repeat(64), vout: 0, value: 500_000, status: { confirmed: true } };
  const viableSim = { utxo: fakeUtxo, simulation: { fundingRequirementSats: 3000 }, insufficient: false };

  /** A snapshot in the shape InscribeMintOrchestrator emits, for driving derived signals. */
  function snapshot(over: Partial<InscribeSnapshot>): InscribeSnapshot {
    return {
      state: 'ready', feeRate: 10, selectedUtxo: null, content: null,
      simulations: [viableSim] as unknown as InscribeSnapshot['simulations'],
      fundingRecommendation: { status: 'auto', recommended: fakeUtxo, candidates: [fakeUtxo] } as unknown as InscribeSnapshot['fundingRecommendation'],
      errorMessage: null, successResult: null,
      ...over,
    };
  }

  let cat21: {
    getUtxos: ReturnType<typeof vi.fn>;
    postTransaction: ReturnType<typeof vi.fn>;
    recommendedFees$: BehaviorSubject<unknown>;
  };
  let pastMintsRecord: ReturnType<typeof vi.fn>;
  let component: StartComponent;

  /** The component's constructed orchestrator instance. */
  function orch(): {
    mint: (...a: unknown[]) => Promise<unknown>;
    setWallet: (...a: unknown[]) => Promise<void>;
    setFeeRate: (...a: unknown[]) => void;
    setContent: (...a: unknown[]) => void;
    setSelectedUtxo: (...a: unknown[]) => void;
  } {
    return (component as unknown as { orch: ReturnType<typeof orch> }).orch;
  }

  /** Drive the component's snapshot signal directly. */
  function setSnap(over: Partial<InscribeSnapshot>): void {
    (component as unknown as { snap: { set(s: InscribeSnapshot): void } }).snap.set(snapshot(over));
  }

  beforeEach(() => {
    TestBed.resetTestingModule();

    cat21 = {
      getUtxos: vi.fn(() => of([])),
      postTransaction: vi.fn(() => of('txid')),
      recommendedFees$: new BehaviorSubject<unknown>(null),
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
        { provide: Cat21Service, useValue: cat21 },
        { provide: UtxoContentScanner, useValue: { states$: new BehaviorSubject(new Map()), autoScan: vi.fn(), reset: vi.fn(), scan: vi.fn(() => of(undefined)), classify: vi.fn(() => Promise.resolve('clean')) } },
        { provide: CubesDataService, useValue: { getCursor: () => of({}), getInscriptions: () => of({ inscriptions: [], totalInscriptions: 0, currentPage: 1, itemsPerPage: 12 }) } },
        { provide: CubeSuggestionService, useValue: { getCubeSuggestion: () => of(null) } },
        { provide: InscriptionLookupService, useValue: { lookupById: () => of(null) } },
        { provide: PriceService, useValue: { getBtcUsd: () => of(null) } },
        { provide: PastMintsService, useValue: { record: pastMintsRecord } },
      ],
    });

    component = TestBed.runInInjectionContext(() => new StartComponent());

    // Neutralize the real orchestrator's mutating setters so the wallet /
    // form effects (and mint()'s setContent) don't re-emit through subscribe
    // and clobber the snapshot each test drives. mint is spied per-test.
    vi.spyOn(orch(), 'setWallet').mockResolvedValue(undefined);
    vi.spyOn(orch(), 'setFeeRate').mockReturnValue(undefined);
    vi.spyOn(orch(), 'setContent').mockReturnValue(undefined);
    vi.spyOn(orch(), 'setSelectedUtxo').mockReturnValue(undefined);

    // Drive the form to a valid state so canMint() is satisfied.
    (component as unknown as { mintFormData: { set(v: unknown): void } }).mintFormData.set({
      inscriptionId1: VALID_ID, inscriptionId2: VALID_ID, inscriptionId3: VALID_ID,
      inscriptionId4: VALID_ID, inscriptionId5: VALID_ID, inscriptionId6: VALID_ID,
      title: '', rotationSpeedX: '', rotationSpeedY: '', colorPane: '', bgColor1: '', bgColor2: '',
      feeRate: 10,
    });
  });

  it('threads the psbtPrompt callback into InscribeMintOrchestrator.mint()', async () => {
    const mintSpy = vi.spyOn(orch(), 'mint').mockResolvedValue({ commitTxId: 'c', revealTxId: 'r' });
    // Ready + auto recommendation → canMint() is true so mint() reaches the orchestrator.
    setSnap({ state: 'ready', selectedUtxo: null });

    await component.mint();

    expect(mintSpy).toHaveBeenCalledTimes(1);
    const promptArg = mintSpy.mock.calls[0][0];
    expect(typeof promptArg).toBe('function');
    expect(pastMintsRecord).toHaveBeenCalledTimes(1);
    expect(pastMintsRecord).toHaveBeenCalledWith('c', 'r', expect.arrayContaining([VALID_ID]));
  });

  it('submitSignedPsbt closes the export modal with the trimmed pasted PSBT', () => {
    const close = vi.fn();
    (component as unknown as { psbtModalRef: { close(v: string): void } }).psbtModalRef = { close };
    component.setSignedPsbtInput('  cHNidAABBQ==  ');
    component.submitSignedPsbt();
    expect(close).toHaveBeenCalledWith('cHNidAABBQ==');
  });

  it('rejects a non-finite or over-ceiling feeRate (guards the SDK 1000 sat/vB gate)', () => {
    const c = component as unknown as { mintFormData: { update(fn: (v: Record<string, unknown>) => Record<string, unknown>): void }; mintForm: () => { valid(): boolean } };
    const setFee = (feeRate: unknown) => c.mintFormData.update((v) => ({ ...v, feeRate }));
    setFee(10);
    expect(c.mintForm().valid()).toBe(true);
    setFee(1001);
    expect(c.mintForm().valid()).toBe(false);
    setFee(Infinity);
    expect(c.mintForm().valid()).toBe(false);
  });

  it('drives the gate off the EFFECTIVE funding coin: manual pick, then the safe auto-pick fallback', () => {
    const c = component as unknown as { selectedRow(): unknown };
    // Manual pick → a row is selected.
    setSnap({ selectedUtxo: fakeUtxo });
    expect(c.selectedRow()).not.toBeNull();

    // No manual pick, but the recommendation still auto-picks a content-clean
    // coin → the effective coin (and its row) stays resolved. The footgun fix.
    setSnap({ selectedUtxo: null, fundingRecommendation: { status: 'auto', recommended: fakeUtxo, candidates: [fakeUtxo] } as unknown as InscribeSnapshot['fundingRecommendation'] });
    expect(c.selectedRow()).not.toBeNull();

    // No manual pick AND nothing safe to auto-pick (expert-required: only
    // asset-bearing coins cover) → the row clears; the pre-connect estimate reappears.
    setSnap({ selectedUtxo: null, fundingRecommendation: { status: 'expert-required', recommended: null, candidates: [fakeUtxo] } as unknown as InscribeSnapshot['fundingRecommendation'] });
    expect(c.selectedRow()).toBeNull();
  });
});
