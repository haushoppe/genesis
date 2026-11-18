/**
 * @test-kind unit
 * Real:   StartComponent class through Angular DI (no template), its own InscribeMintOrchestrator,
 *         Cat21Service, UtxoContentScanner and WalletService (ordpool-sdk, constructed as in
 *         app.config.ts)
 * Faked:  fetch -> the esplora UTXO list (electrsConfirmedUtxoFixture, ordpool-sdk/testing), the
 *         fee estimate (recommendedFeesFixture, ordpool-sdk/testing) and the two ord `/output`
 *         answers per coin (inscribedOutputFixture, cleanOutputFixture, ordpool-sdk);
 *         WalletService storage -> an in-memory map holding a persisted watch-only identity;
 *         environment -> the real one with loopback hosts, a regtest network and tip, and no
 *         cubes index or archive (vi.mock spreading vi.importActual); SideImageProbeService ->
 *         every side renders; HttpClient -> HttpTestingController, nothing answered
 * Proves: the funding notice names the coin that WILL be spent. After an explicit pick the
 *         notice lists that coin's assets rather than the recommended coin's, and a pick of an
 *         asset coin while a clean coin covers raises the notice at all; the reassurance about a
 *         separate ordinals address is only given to a wallet that has one; a blocked mint marks
 *         ord's best fit in the picker; and while the content scan runs the panel reports
 *         scanning rather than an empty wallet
 */
import { provideZonelessChangeDetection } from '@angular/core';
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
  ExpertRequiredCause,
  getDummyKeypair,
  inscribedOutputFixture,
  InscribeSnapshot,
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
import { FundingAssetRow } from './funding-asset-rows';
import { SideImageProbeService } from './side-image-probe.service';
import { StartComponent } from './start.component';

const dummy = getDummyKeypair(toScureNetwork(Network.Regtest));
/** Watch-only identity with a SEPARATE payment address. */
const SEPARATE = { ordinals: dummy.addressP2TR, payment: dummy.addressP2WPKH };
/** Watch-only identity that keeps ordinals and spending money on ONE address. */
const ONE_ADDRESS = { ordinals: dummy.addressP2TR, payment: dummy.addressP2TR };

/**
 * Two coins that both cover the mint. SMALL is ord's best fit for the amount
 * and therefore the recommendation; BIG sits above the scanner's auto-scan
 * threshold, so only the SDK's force-scan of every covering candidate knows
 * what it carries.
 */
const SMALL: TxnOutput = electrsConfirmedUtxoFixture({ txid: 'a'.repeat(64), vout: 0, value: 40_000 });
const BIG: TxnOutput = electrsConfirmedUtxoFixture({ txid: 'b'.repeat(64), vout: 1, value: 300_000 });

const SMALL_INSCRIPTION = `${'1'.repeat(64)}i0`;
const BIG_INSCRIPTION = `${'2'.repeat(64)}i0`;

const VALID_SIDE = `${'a'.repeat(64)}i0`;

const outpoint = (u: TxnOutput) => `${u.txid}:${u.vout}`;

/** A Response the SDK's fetch helpers read: status plus a JSON body. */
function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/**
 * The network as the SDK sees it: the esplora UTXO list and fee estimate, and
 * both ord `/output` answers for each of the two coins. Anything else is a
 * request this spec did not expect and fails loudly rather than hanging.
 *
 * @param holdScan A promise the `/output` answers wait for, so a spec can hold
 *   the content scan in flight and read the state the page is in while it runs.
 */
function stubNetwork(
  payment: string,
  content: { small: OutputFixture; big: OutputFixture },
  holdScan?: Promise<void>,
): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === `${environment.mempoolApiUrl}/api/address/${payment}/utxo`) return json([SMALL, BIG]);
    if (url === `${environment.mempoolApiUrl}/api/v1/fees/recommended`) return json(recommendedFeesFixture());
    await holdScan;
    if (url === `${environment.ordApiUrl}/output/${outpoint(SMALL)}`) return json(content.small.ord);
    if (url === `${environment.cat21OrdApiUrl}/output/${outpoint(SMALL)}`) return json(content.small.cat21Ord);
    if (url === `${environment.ordApiUrl}/output/${outpoint(BIG)}`) return json(content.big.ord);
    if (url === `${environment.cat21OrdApiUrl}/output/${outpoint(BIG)}`) return json(content.big.cat21Ord);
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

/** The component's protected members this spec reads. */
interface StartView {
  fundingRecommendation(): InscribeSnapshot['fundingRecommendation'];
  effectiveFundingUtxo(): TxnOutput | null;
  fundingAssetNotice(): boolean;
  noticeAssetRows(): FundingAssetRow[];
  noticeOneAddress(): boolean;
  fundingExpertCause(): ExpertRequiredCause | null;
  fundingScanning(): boolean;
  bestFitUnpicked(): TxnOutput | null;
  canMint(): boolean;
  mintState(): string;
  simulations(): unknown[];
  viableRows(): unknown[];
  pickUtxo(utxo: TxnOutput): void;
  mintFormData: { update(fn: (v: Record<string, unknown>) => Record<string, unknown>): void };
}

/**
 * The real StartComponent class wired the way app.config.ts wires it, with a
 * restored watch-only wallet, the six sides filled and the network answering
 * for both coins.
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
    feeRate: 10,
  }));
  TestBed.tick();
  return component;
}

/** Waits until the SDK has resolved a coin, or blocked on purpose. */
async function settled(component: StartView): Promise<void> {
  await vi.waitFor(() => {
    TestBed.tick();
    if (component.fundingScanning()) throw new Error('still scanning');
  }, { timeout: 5_000, interval: 25 });
}

/** The labels of the notice rows, which is what a reader sees listed. */
const labels = (component: StartView) => component.noticeAssetRows().map((r) => r.label);

describe('the funding notice describes the coin that will be spent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('no clean coin covers, and the reader picks the coin we did not recommend', () => {
    let component: StartView;

    beforeEach(async () => {
      stubNetwork(SEPARATE.payment, {
        small: inscribedOutputFixture(SMALL_INSCRIPTION),
        big: inscribedOutputFixture(BIG_INSCRIPTION),
      });
      component = startComponent(SEPARATE);
      await settled(component);
    });

    it('recommends the best fit and names its inscription', () => {
      expect(component.fundingRecommendation().status).toBe('asset-notice');
      expect(component.fundingRecommendation().recommended?.txid).toBe(SMALL.txid);
      expect(component.effectiveFundingUtxo()).toMatchObject({ txid: SMALL.txid, vout: SMALL.vout });
      expect(labels(component)).toEqual([SMALL_INSCRIPTION]);
    });

    it('names the PICKED coin after an explicit pick, while the recommendation stays put', async () => {
      component.pickUtxo(BIG);
      await vi.waitFor(() => {
        TestBed.tick();
        if (component.effectiveFundingUtxo()?.txid !== BIG.txid) throw new Error('pick not resolved yet');
      }, { timeout: 5_000, interval: 25 });

      // The SDK still recommends the small coin: that is what makes reading the
      // recommendation here a defect rather than a harmless shortcut.
      expect(component.fundingRecommendation().recommended?.txid).toBe(SMALL.txid);
      expect(component.fundingAssetNotice()).toBe(true);
      expect(labels(component)).toEqual([BIG_INSCRIPTION]);
      expect(component.canMint()).toBe(true);
    });
  });

  it('raises the notice for an asset coin picked while a clean coin covers', async () => {
    stubNetwork(SEPARATE.payment, {
      small: cleanOutputFixture(),
      big: inscribedOutputFixture(BIG_INSCRIPTION),
    });
    const component = startComponent(SEPARATE);
    await settled(component);

    // The clean coin covers, so the SDK auto-picks it and says nothing.
    expect(component.fundingRecommendation().status).toBe('auto');
    expect(component.fundingAssetNotice()).toBe(false);
    expect(labels(component)).toEqual([]);

    component.pickUtxo(BIG);
    await vi.waitFor(() => {
      TestBed.tick();
      if (!component.fundingAssetNotice()) throw new Error('no notice yet');
    }, { timeout: 5_000, interval: 25 });

    // The recommendation is still the clean coin, and a notice read from it
    // would list nothing at all while an inscription-bearing coin is spent.
    expect(component.fundingRecommendation().status).toBe('auto');
    expect(component.effectiveFundingUtxo()).toMatchObject({ txid: BIG.txid, vout: BIG.vout });
    expect(labels(component)).toEqual([BIG_INSCRIPTION]);
  });

  it('promises a separate ordinals address only to a wallet that has one', async () => {
    stubNetwork(SEPARATE.payment, {
      small: inscribedOutputFixture(SMALL_INSCRIPTION),
      big: inscribedOutputFixture(BIG_INSCRIPTION),
    });
    const separate = startComponent(SEPARATE);
    await settled(separate);
    expect(separate.fundingAssetNotice()).toBe(true);
    expect(separate.noticeOneAddress()).toBe(false);

    // Same coins on a wallet that keeps everything on one address: the SDK
    // blocks instead of noticing, and a pick turns it into a notice whose
    // reassurance about a separate address would be false.
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    stubNetwork(ONE_ADDRESS.payment, {
      small: inscribedOutputFixture(SMALL_INSCRIPTION),
      big: inscribedOutputFixture(BIG_INSCRIPTION),
    });
    const oneAddress = startComponent(ONE_ADDRESS);
    await settled(oneAddress);
    expect(oneAddress.fundingExpertCause()).toBe('named-assets');

    oneAddress.pickUtxo(BIG);
    await vi.waitFor(() => {
      TestBed.tick();
      if (!oneAddress.fundingAssetNotice()) throw new Error('no notice yet');
    }, { timeout: 5_000, interval: 25 });
    expect(oneAddress.noticeOneAddress()).toBe(true);
    expect(labels(oneAddress)).toEqual([BIG_INSCRIPTION]);
  });

  it('marks ord\'s best fit in the picker while the mint is blocked', async () => {
    stubNetwork(ONE_ADDRESS.payment, {
      small: inscribedOutputFixture(SMALL_INSCRIPTION),
      big: inscribedOutputFixture(BIG_INSCRIPTION),
    });
    const component = startComponent(ONE_ADDRESS);
    await settled(component);

    // Nothing is picked, so without the best-fit mark the reader is told to
    // choose a coin with nothing to go on.
    expect(component.effectiveFundingUtxo()).toBeNull();
    expect(component.bestFitUnpicked()).toMatchObject({ txid: SMALL.txid, vout: SMALL.vout });

    // Once a coin is resolved the Selected badge marks it, so the best-fit
    // mark goes away rather than sitting beside it on another row.
    component.pickUtxo(BIG);
    await vi.waitFor(() => {
      TestBed.tick();
      if (component.effectiveFundingUtxo()?.txid !== BIG.txid) throw new Error('pick not resolved yet');
    }, { timeout: 5_000, interval: 25 });
    expect(component.bestFitUnpicked()).toBeNull();
  });

  it('reports the scan rather than an empty wallet while the coins are being checked', async () => {
    // The scan is held open, so the state under test is not a race: the ord
    // answers land only when this spec lets them.
    let releaseScan!: () => void;
    const holdScan = new Promise<void>((resolve) => { releaseScan = resolve; });
    stubNetwork(SEPARATE.payment, {
      small: inscribedOutputFixture(SMALL_INSCRIPTION),
      big: inscribedOutputFixture(BIG_INSCRIPTION),
    }, holdScan);
    const component = startComponent(SEPARATE);

    // The two coins are read and the fee rate is known, so the page is past
    // "checking your wallet" with no priced row yet. That is the exact pair the
    // template branches on, and the branch it used to take says "send some BTC"
    // to a wallet holding 340 000 sat.
    await vi.waitFor(() => {
      TestBed.tick();
      if (component.mintState() !== 'ready') throw new Error(`state is ${component.mintState()}`);
    }, { timeout: 5_000, interval: 25 });
    expect(component.viableRows()).toEqual([]);
    expect(component.simulations()).toEqual([]);
    expect(component.fundingScanning()).toBe(true);
    expect(component.effectiveFundingUtxo()).toBeNull();

    releaseScan();
    await settled(component);
    expect(component.fundingScanning()).toBe(false);
    expect(component.effectiveFundingUtxo()).not.toBeNull();
  });
});
