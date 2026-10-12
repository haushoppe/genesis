/**
 * @test-kind unit
 * Real:   StartComponent class through Angular DI (no template), its own InscribeMintOrchestrator,
 *         Cat21Service, UtxoContentScanner and WalletService (ordpool-sdk, constructed as in
 *         app.config.ts), FundingDroppedSelection rendered through TestBed
 * Faked:  fetch -> the esplora UTXO list (electrsConfirmedUtxoFixture, ordpool-sdk/testing), the fee
 *         estimate (recommendedFeesFixture, ordpool-sdk/testing) and both ord `/output` answers per
 *         coin (cleanOutputFixture, inscribedOutputFixture, ordpool-sdk); WalletService storage -> an
 *         in-memory map holding a persisted watch-only identity; environment -> the real one with
 *         loopback hosts, a regtest network and tip, and no cubes index or archive (vi.mock
 *         spreading vi.importActual); SideImageProbeService -> every side renders (the browser image
 *         decode it fronts); HttpClient -> HttpTestingController, nothing answered
 * Proves: a pick the SDK honours reads as the reader's pick; a pick that no longer covers at the
 *         fee rate, or that left the wallet, reads as dropped with the SDK's reason while the mint
 *         falls back to the coin the SDK resolves, or to none on expert-required; the notice names
 *         the dropped coin, the remedy for its reason and the replacement or its absence
 */
import { Input, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Loopback hosts and a regtest chain: the default environment's tip address is
// the '???' placeholder, which makes deriveNetwork() throw, and its hosts are
// production ones, which no unit spec names. SPREAD the real environment so a
// field added later is present here too.
vi.mock('../../environments/environment', async () => {
  const actual = await vi.importActual<typeof import('../../environments/environment')>(
    '../../environments/environment',
  );
  return {
    environment: {
      ...actual.environment,
      network: 'regtest' as const,
      mempoolApiUrl: 'http://127.0.0.1:3010',
      ordApiUrl: 'http://127.0.0.1:8081',
      cat21OrdApiUrl: 'http://127.0.0.1:8080',
      sideImageProbeBase: 'http://127.0.0.1:8081',
      haushoppeTipAddress: 'bcrt1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqvg32hk',
      cubesIndexBase: '',
      archiveBase: '',
      suggestionGalleries: [],
    },
  };
});

import {
  Cat21SdkConfig,
  Cat21Service,
  cleanOutputFixture,
  DroppedSelection,
  getDummyKeypair,
  InscribeMintOrchestrator,
  InscribeSnapshot,
  inscribedOutputFixture,
  KnownOrdinalWalletType,
  LAST_CONNECTED_WALLET,
  Network,
  OutputFixture,
  toScureNetwork,
  TxnOutput,
  UtxoContentScanner,
  WalletService,
} from 'ordpool-sdk';
import { electrsConfirmedUtxoFixture, recommendedFeesFixture } from 'ordpool-sdk/testing';
import { hex } from '@scure/base';

import { environment } from '../../environments/environment';
import { bitcoinNetwork, cat21Config } from '../shared/sdk-tokens';
import { FundingDroppedSelection } from './funding-dropped-selection';
import { SideImageProbeService } from './side-image-probe.service';
import { StartComponent } from './start.component';

const dummy = getDummyKeypair(toScureNetwork(Network.Regtest));
/** Watch-only identity with a SEPARATE payment address: a clean coin is auto-picked. */
const SEPARATE = { ordinals: dummy.addressP2TR, payment: dummy.addressP2WPKH };
/** Watch-only identity that keeps ordinals and spending money on ONE address. */
const ONE_ADDRESS = { ordinals: dummy.addressP2TR, payment: dummy.addressP2TR };

/** Covers the mint at LOW_RATE and not at HIGH_RATE; each case asserts both before relying on it. */
const SMALL: TxnOutput = electrsConfirmedUtxoFixture({ txid: 'c'.repeat(64), vout: 0, value: 20_000 });
/** Covers the mint at both rates. */
const BIG: TxnOutput = electrsConfirmedUtxoFixture({ txid: 'd'.repeat(64), vout: 1, value: 5_000_000 });
const LOW_RATE = 2;
const HIGH_RATE = 500;

const VALID_SIDE = `${'a'.repeat(64)}i0`;

const outpoint = (u: { txid: string; vout: number }) => `${u.txid}:${u.vout}`;

/** A Response the SDK's fetch helpers read: status plus a JSON body. */
function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/**
 * The network as the SDK sees it. `wallet.coins` is read on every UTXO request,
 * so a case can take a coin out of the wallet and have the next read see it
 * gone. Anything else is a request this spec did not expect and fails loudly.
 */
function stubNetwork(payment: string, wallet: { coins: TxnOutput[] }, outputs: Record<string, OutputFixture>): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === `${environment.mempoolApiUrl}/api/address/${payment}/utxo`) return json(wallet.coins);
    if (url === `${environment.mempoolApiUrl}/api/v1/fees/recommended`) return json(recommendedFeesFixture());
    for (const [op, output] of Object.entries(outputs)) {
      if (url === `${environment.ordApiUrl}/output/${op}`) return json(output.ord);
      if (url === `${environment.cat21OrdApiUrl}/output/${op}`) return json(output.cat21Ord);
    }
    throw new Error(`unexpected request in spec: ${url}`);
  }));
}

/** In-memory `StorageLike` holding the watch-only identity WalletService restores. */
function storageWith(identity: { ordinals: string; payment: string }) {
  const map = new Map<string, string>([[LAST_CONNECTED_WALLET, JSON.stringify({
    type: KnownOrdinalWalletType.xpub,
    ordinalsAddress: identity.ordinals,
    ordinalsPublicKey: hex.encode(dummy.dummyPublicKey),
    paymentAddress: identity.payment,
    paymentPublicKey: hex.encode(dummy.dummyPublicKey),
    signingSupported: true,
  })]]);
  return {
    getValue: (k: string) => map.get(k) ?? null,
    setValue: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
}

/** The component's protected and private members this spec reads. */
interface StartView {
  orch: InscribeMintOrchestrator;
  snap(): InscribeSnapshot;
  selectedUtxo(): TxnOutput | null;
  droppedSelection(): DroppedSelection | null;
  pickHonoured(): boolean;
  effectiveFundingUtxo(): TxnOutput | null;
  canMint(): boolean;
  pickUtxo(utxo: TxnOutput): void;
  setFeePreset(rate: number): void;
  mintFormData: { update(fn: (v: Record<string, unknown>) => Record<string, unknown>): void };
}

/**
 * The real StartComponent class wired the way app.config.ts wires it, with a
 * restored watch-only wallet and the six sides filled at LOW_RATE.
 */
function startComponent(identity: { ordinals: string; payment: string }): StartView {
  const config: Cat21SdkConfig = {
    mempoolApiUrl: environment.mempoolApiUrl,
    cat21ApiUrl: 'http://127.0.0.1:3011',
    ordApiUrl: environment.ordApiUrl,
    cat21OrdApiUrl: environment.cat21OrdApiUrl,
  };
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: NgbModal, useValue: { open: vi.fn() } },
      { provide: cat21Config, useValue: config },
      { provide: bitcoinNetwork, useValue: Network.Regtest },
      { provide: Cat21Service, useFactory: () => new Cat21Service(config, Network.Regtest) },
      { provide: UtxoContentScanner, useFactory: () => new UtxoContentScanner(config) },
      { provide: WalletService, useFactory: () => new WalletService({ storage: storageWith(identity), network: Network.Regtest }) },
      // The browser image decode is the IO this service fronts; every side renders.
      {
        provide: SideImageProbeService,
        useValue: { probe: (ids: readonly string[]) => of(Object.fromEntries(ids.map((id) => [id, 'ok']))) },
      },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new StartComponent()) as unknown as StartView;
  component.mintFormData.update((v) => ({
    ...v,
    inscriptionId1: VALID_SIDE, inscriptionId2: VALID_SIDE, inscriptionId3: VALID_SIDE,
    inscriptionId4: VALID_SIDE, inscriptionId5: VALID_SIDE, inscriptionId6: VALID_SIDE,
    feeRate: LOW_RATE,
  }));
  TestBed.tick();
  return component;
}

/** Waits until the component's snapshot satisfies `done`. */
async function until(component: StartView, what: string, done: (s: InscribeSnapshot) => boolean): Promise<InscribeSnapshot> {
  await vi.waitFor(() => {
    TestBed.tick();
    if (!done(component.snap())) throw new Error(`not yet: ${what}`);
  }, { timeout: 5_000, interval: 25 });
  return component.snap();
}

/** The simulation row of `coin` in a snapshot, or undefined when the grid has none for it. */
function rowOf(s: InscribeSnapshot, coin: TxnOutput) {
  return s.simulations.find((r) => outpoint(r.utxo) === outpoint(coin));
}

/**
 * Both coins simulated at `rate`, the funding recommendation settled. The
 * snapshot's `feeRate` moves before the recompute lands, so the grid is read
 * at the rate BIG's simulation was priced at (it covers at every rate here).
 */
function settledAt(rate: number) {
  return (s: InscribeSnapshot) => {
    const big = rowOf(s, BIG)?.simulation;
    return s.feeRate === rate &&
      rowOf(s, SMALL) !== undefined && big != null &&
      Math.round(big.totalFeeSats / big.combinedVsize) === rate &&
      s.fundingRecommendation.status !== 'scanning';
  };
}

/** The notice as a reader sees it. */
function renderNotice(dropped: DroppedSelection, replacement: TxnOutput | null): HTMLElement {
  const fixture = TestBed.createComponent(FundingDroppedSelection);
  fixture.componentRef.setInput('dropped', dropped);
  fixture.componentRef.setInput('replacement', replacement);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const collapsed = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const short = (u: { txid: string; vout: number }) => `${u.txid.slice(0, 12)}…:${u.vout}`;

describe('droppedSelection: a replaced funding pick is named, never shown as the reader\'s pick', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    // vitest runs the component through JIT, which cannot see an `input()`
    // field before the class is instantiated. The Angular CLI adds exactly this
    // decorator for JIT builds; the spec does the same so `setInput` reaches
    // the signal.
    Input({ isSignal: true, alias: 'dropped', required: true } as never)(FundingDroppedSelection.prototype, 'dropped');
    Input({ isSignal: true, alias: 'replacement', required: true } as never)(FundingDroppedSelection.prototype, 'replacement');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('a separate-payment-address wallet with two clean coins', () => {
    let wallet: { coins: TxnOutput[] };
    let component: StartView;

    beforeEach(async () => {
      wallet = { coins: [SMALL, BIG] };
      stubNetwork(SEPARATE.payment, wallet, {
        [outpoint(SMALL)]: cleanOutputFixture(),
        [outpoint(BIG)]: cleanOutputFixture(),
      });
      component = startComponent(SEPARATE);
      const s = await until(component, `both coins simulated at ${LOW_RATE} sat/vB`, settledAt(LOW_RATE));
      // The precondition every case below rests on: both coins cover here.
      expect(rowOf(s, SMALL)?.simulation).not.toBeNull();
      expect(rowOf(s, BIG)?.simulation).not.toBeNull();
    });

    it('a pick the SDK honours is the reader\'s pick, and nothing is dropped', async () => {
      component.pickUtxo(BIG);
      const s = await until(component, 'the pick resolved', (snap) => snap.selectedUtxo !== null && snap.resolvedFundingUtxo !== null && outpoint(snap.resolvedFundingUtxo) === outpoint(BIG));
      expect(s.droppedSelection).toBeNull();
      expect(component.droppedSelection()).toBeNull();
      expect(component.pickHonoured()).toBe(true);
      expect(component.effectiveFundingUtxo()).toMatchObject({ txid: BIG.txid, vout: BIG.vout });
    });

    it('a pick that no longer covers at the fee rate is dropped as below-requirement, and the mint falls back to the coin that covers', async () => {
      component.pickUtxo(SMALL);
      await until(component, 'the small pick resolved', (snap) => snap.resolvedFundingUtxo !== null && outpoint(snap.resolvedFundingUtxo) === outpoint(SMALL));
      expect(component.pickHonoured()).toBe(true);

      component.setFeePreset(HIGH_RATE);
      const s = await until(component, `both coins simulated at ${HIGH_RATE} sat/vB`, settledAt(HIGH_RATE));
      // The precondition: the picked coin is still in the wallet and no longer covers.
      expect(rowOf(s, SMALL)?.simulation).toBeNull();
      expect(rowOf(s, BIG)?.simulation).not.toBeNull();

      expect(component.selectedUtxo()).toMatchObject({ txid: SMALL.txid, vout: SMALL.vout });
      expect(component.droppedSelection()).toEqual({ txid: SMALL.txid, vout: SMALL.vout, reason: 'below-requirement' });
      expect(component.pickHonoured()).toBe(false);
      expect(component.effectiveFundingUtxo()).toMatchObject({ txid: BIG.txid, vout: BIG.vout });
      expect(component.canMint()).toBe(true);

      const el = renderNotice(component.droppedSelection() as DroppedSelection, component.effectiveFundingUtxo());
      expect(collapsed(el)).toBe(
        `The funding coin you picked, ${short(SMALL)}, no longer covers this mint at this fee rate. ` +
        `Lower the fee rate or pick another coin below. For now this mint is funded by ${short(BIG)}.`,
      );
    });

    it('lowering the rate again brings the pick back, and the drop clears', async () => {
      component.pickUtxo(SMALL);
      await until(component, 'the small pick resolved', (snap) => snap.resolvedFundingUtxo !== null && outpoint(snap.resolvedFundingUtxo) === outpoint(SMALL));
      component.setFeePreset(HIGH_RATE);
      await until(component, 'the drop', (snap) => snap.droppedSelection !== null);

      component.setFeePreset(LOW_RATE);
      await until(component, `both coins simulated at ${LOW_RATE} sat/vB`, settledAt(LOW_RATE));
      expect(component.droppedSelection()).toBeNull();
      expect(component.pickHonoured()).toBe(true);
      expect(component.effectiveFundingUtxo()).toMatchObject({ txid: SMALL.txid, vout: SMALL.vout });
    });

    it('a pick that left the wallet is dropped as gone, and the mint falls back to the remaining coin', async () => {
      component.pickUtxo(BIG);
      await until(component, 'the big pick resolved', (snap) => snap.resolvedFundingUtxo !== null && outpoint(snap.resolvedFundingUtxo) === outpoint(BIG));

      // The picked coin is spent elsewhere; the wallet's next UTXO read no longer lists it.
      wallet.coins = [SMALL];
      await component.orch.refreshUtxos();
      await until(component, 'the drop', (snap) => snap.droppedSelection !== null);

      expect(component.droppedSelection()).toEqual({ txid: BIG.txid, vout: BIG.vout, reason: 'gone' });
      expect(component.pickHonoured()).toBe(false);
      expect(component.effectiveFundingUtxo()).toMatchObject({ txid: SMALL.txid, vout: SMALL.vout });

      const el = renderNotice(component.droppedSelection() as DroppedSelection, component.effectiveFundingUtxo());
      expect(collapsed(el)).toBe(
        `The funding coin you picked, ${short(BIG)}, is no longer available. ` +
        `Pick another coin below. For now this mint is funded by ${short(SMALL)}.`,
      );
    });
  });

  it('on a one-address wallet whose only covering coin carries an inscription, the drop names no replacement and Mint stays disabled', async () => {
    stubNetwork(ONE_ADDRESS.payment, { coins: [SMALL, BIG] }, {
      [outpoint(SMALL)]: cleanOutputFixture(),
      [outpoint(BIG)]: inscribedOutputFixture(),
    });
    const component = startComponent(ONE_ADDRESS);
    await until(component, `both coins simulated at ${LOW_RATE} sat/vB`, settledAt(LOW_RATE));
    component.pickUtxo(SMALL);
    await until(component, 'the small pick resolved', (snap) => snap.resolvedFundingUtxo !== null && outpoint(snap.resolvedFundingUtxo) === outpoint(SMALL));

    component.setFeePreset(HIGH_RATE);
    const s = await until(component, `both coins simulated at ${HIGH_RATE} sat/vB`, settledAt(HIGH_RATE));
    expect(rowOf(s, SMALL)?.simulation).toBeNull();
    expect(s.fundingRecommendation.status).toBe('expert-required');
    expect(s.fundingRecommendation.recommended).toMatchObject({ txid: BIG.txid, vout: BIG.vout });

    expect(component.droppedSelection()).toEqual({ txid: SMALL.txid, vout: SMALL.vout, reason: 'below-requirement' });
    expect(component.pickHonoured()).toBe(false);
    expect(component.effectiveFundingUtxo()).toBeNull();
    expect(component.canMint()).toBe(false);

    const el = renderNotice(component.droppedSelection() as DroppedSelection, component.effectiveFundingUtxo());
    expect(collapsed(el)).toBe(
      `The funding coin you picked, ${short(SMALL)}, no longer covers this mint at this fee rate. ` +
      `Lower the fee rate or pick another coin below. No other coin is picked for you.`,
    );
  });
});
