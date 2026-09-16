import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SideImageProbeService } from './side-image-probe.service';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, map, of } from 'rxjs';
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
  Cat21Service, getDummyKeypair, InscribeMintOrchestrator, InscribeSnapshot, KnownOrdinalWalletType, Network,
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

  /**
   * A snapshot in the shape InscribeMintOrchestrator emits, for driving derived
   * signals.
   *
   * The base comes from a real orchestrator rather than a hand-written literal:
   * it emits its current snapshot on subscribe, so this is the actual initial
   * shape with the actual defaults. A literal would silently fall behind every
   * field the SDK adds, and vitest strips types, so nothing here would say so.
   */
  const emptySnapshot = ((): InscribeSnapshot => {
    let captured: InscribeSnapshot | null = null;
    new InscribeMintOrchestrator({
      getUtxos: async () => [],
      scan: { classify: async () => 'clean' },
      broadcast: async () => '',
      network: Network.Regtest,
    }).subscribe((s) => { captured ??= s; });
    if (captured === null) throw new Error('the orchestrator did not emit its snapshot on subscribe');
    return captured;
  })();

  function snapshot(over: Partial<InscribeSnapshot>): InscribeSnapshot {
    return {
      ...emptySnapshot,
      state: 'ready', feeRate: 10,
      simulations: [viableSim] as unknown as InscribeSnapshot['simulations'],
      fundingRecommendation: { status: 'auto', recommended: fakeUtxo, candidates: [fakeUtxo] } as unknown as InscribeSnapshot['fundingRecommendation'],
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
  let walletSubject: BehaviorSubject<unknown>;

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
    walletSubject = new BehaviorSubject<unknown>(wallet);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        // The list's order and page are query parameters, so the component
        // injects Router + ActivatedRoute.
        provideRouter([]),
        { provide: NgbModal, useValue: { open: vi.fn() } },
        {
          provide: WalletService,
          // walletReadiness$ derives from connectedWallet$ in the real service,
          // so the stand-in mirrors that: a connected identity is ready, and
          // nothing connected is disconnected. Shaped from the SDK's published
          // WalletReadiness union, not invented here.
          useValue: {
            connectedWallet$: walletSubject,
            requestWalletConnect: vi.fn(),
            disconnectWallet: vi.fn(),
            walletReadiness$: walletSubject.pipe(
              map((w) => (w === null ? { state: 'disconnected' as const } : { state: 'ready' as const, wallet: w })),
            ),
          },
        },
        { provide: Cat21Service, useValue: cat21 },
        { provide: UtxoContentScanner, useValue: { states$: new BehaviorSubject(new Map()), autoScan: vi.fn(), reset: vi.fn(), scan: vi.fn(() => of(undefined)), classify: vi.fn(() => Promise.resolve('clean')) } },
        { provide: CubesDataService, useValue: { getCursor: () => of({}), getInscriptions: () => of({ inscriptions: [], totalInscriptions: 0, currentPage: 1, itemsPerPage: 12 }) } },
        { provide: CubeSuggestionService, useValue: { getCubeSuggestion: () => of(null) } },
        { provide: InscriptionLookupService, useValue: { lookupById: () => of(null) } },
        { provide: PriceService, useValue: { getBtcUsd: () => of(null) } },
        { provide: PastMintsService, useValue: { record: pastMintsRecord } },
        // Stand-in for the browser image probe: any id ending in `i1` is a
        // side that does not render, everything else does.
        {
          provide: SideImageProbeService,
          useValue: {
            probe: (ids: readonly string[]) =>
              of(Object.fromEntries(ids.map((id) => [id, id.endsWith('i1') ? 'black' : 'ok']))),
          },
        },
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
    // Flush effects so the side image probe (a resource) has answered.
    TestBed.tick();
  });

  it('a side that does not render as an image blocks the mint and names the face', () => {
    const blackId = VALID_ID.slice(0, 64) + 'i1';
    (component as unknown as { mintFormData: { update(f: (v: Record<string, unknown>) => Record<string, unknown>): void } })
      .mintFormData.update((v) => ({ ...v, inscriptionId2: blackId }));
    TestBed.tick();
    setSnap({ state: 'ready', selectedUtxo: null });

    expect(component['blackFaces']()).toEqual([2]);
    expect(component['blackFacesLabel']()).toBe('Side 2 does not render as an image');
    expect(component['canOpenCheckout']()).toBe(false);
    expect(component['canMint']()).toBe(false);
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

  it('a fees-endpoint error degrades recommendedFees to null and never breaks the checkout total', () => {
    // Regression guard for the money-screen footgun surfaced on the round's last
    // capture: `recommendedFees` is a toSignal of the SDK fees stream, read in the
    // checkout template. On regtest electrs has no /api/v1/fees/recommended (and a
    // prod hiccup does the same), the stream errors, and WITHOUT a catchError
    // toSignal RE-THROWS on read — taking down the whole checkout's change
    // detection so the cost/breakdown/Mint button stop rendering. The fee tiers are
    // a convenience (the fee-rate input works without them), so this must degrade
    // to null, never to a dead screen.
    const c = component as unknown as { recommendedFees(): unknown; totalSpendSats(): number | null };

    // A viable snapshot → the checkout total resolves (funding 3000; change clears dust).
    setSnap({ state: 'ready', selectedUtxo: null });
    expect(c.totalSpendSats()).toBe(3000);

    // The fees stream errors.
    cat21.recommendedFees$.error(new Error('endpoint does not exist "/v1/fees/recommended"'));

    // It must degrade to null, not re-throw (the throw is what killed the checkout).
    expect(() => c.recommendedFees()).not.toThrow();
    expect(c.recommendedFees()).toBeNull();
    // And the cost total still renders — it does not depend on the fee tiers.
    expect(c.totalSpendSats()).toBe(3000);
  });

  it('craftAnotherCube keeps the six sides in place until the next suggestion lands (no empty interlude)', () => {
    const c = component as unknown as {
      mintFormData: { (): Record<string, string>; update(fn: (v: Record<string, string>) => Record<string, string>): void };
      craftAnotherCube(): void;
    };
    const sides = { inscriptionId1: 'a', inscriptionId2: 'b', inscriptionId3: 'c', inscriptionId4: 'd', inscriptionId5: 'e', inscriptionId6: 'f' };
    c.mintFormData.update((v) => ({ ...v, ...sides }));
    c.craftAnotherCube();
    // The old cube stays previewable while the suggestion reloads; the
    // suggestion effect replaces exactly this snapshot when it resolves.
    for (const [k, v] of Object.entries(sides)) expect(c.mintFormData()[k]).toBe(v);
  });

  it('shows the cube-worded single-address custody caveat only when the wallet uses one address', () => {
    // Detection is ground truth (usesSingleAddress compares the two addresses
    // actually returned), never a hardcoded list.
    const c = component as unknown as { custodyCaveat(): string | null };

    // The default mock wallet returns ONE address for both roles → caveat fires,
    // and it is cube-worded (not the SDK's 'cats' default).
    const caveat = c.custodyCaveat();
    expect(caveat).toContain('your cubes at one address');
    expect(caveat).toContain('cubes.haushoppe.art');
    expect(caveat).not.toContain('your cats at one address');

    // A wallet that hands out DISTINCT payment + ordinals addresses clears it.
    walletSubject.next({
      type: KnownOrdinalWalletType.xverse,
      ordinalsAddress: 'bcrt1p_ordinals_side_distinct_from_payment',
      paymentAddress: 'bcrt1q_payment_side_distinct_from_ordinals',
    });
    expect(c.custodyCaveat()).toBeNull();
  });
});
