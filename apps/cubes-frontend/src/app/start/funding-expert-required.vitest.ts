/**
 * @test-kind unit
 * Real:   StartComponent class through Angular DI (no template), its own InscribeMintOrchestrator,
 *         Cat21Service, UtxoContentScanner and WalletService (ordpool-sdk, constructed as in
 *         app.config.ts), FundingExpertRequired rendered through TestBed
 * Faked:  fetch -> the esplora UTXO list (electrsConfirmedUtxoFixture, ordpool-sdk/testing), the fee estimate (recommendedFeesFixture, ordpool-sdk
 *         /testing) and both ord `/output` answers (inscribedOutputFixture,
 *         notIndexedOutputFixture, ordpool-sdk); WalletService storage -> an in-memory map
 *         holding a persisted watch-only identity; environment -> the real one with loopback
 *         hosts, a regtest network and tip, and no cubes index or archive (vi.mock spreading
 *         vi.importActual); SideImageProbeService -> every side renders (the browser image
 *         decode it fronts); HttpClient -> HttpTestingController, nothing answered
 * Proves: each expert-required cause (named assets on a one-address wallet, assets the scan
 *         does not name, content the scan could not check) keeps Mint disabled with no coin
 *         picked or marked, and renders its own warning text naming the badge it points at;
 *         named assets on a separate-payment-address wallet are a notice, Mint is enabled,
 *         and the component's orchestrator mints from that coin, reaching the signature with
 *         it as the commit's only input
 */
import { Input, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Loopback hosts and a regtest chain: the default environment's tip address
// is the '???' placeholder, which makes deriveNetwork() throw, and its hosts
// are production ones, which no unit spec names. SPREAD the real environment
// so a field added later is present here too.
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
  InscribeBroadcastTransport,
  InscribeMintOrchestrator,
  InscribeSnapshot,
  inscribedOutputFixture,
  KnownOrdinalWalletType,
  LAST_CONNECTED_WALLET,
  Network,
  notIndexedOutputFixture,
  OutputFixture,
  toScureNetwork,
  TxnOutput,
  UtxoContentScanner,
  WalletService,
} from 'ordpool-sdk';
import { electrsConfirmedUtxoFixture, recommendedFeesFixture } from 'ordpool-sdk/testing';
import { base64, hex } from '@scure/base';
import { Transaction } from '@scure/btc-signer';

import { environment } from '../../environments/environment';
import { bitcoinNetwork, cat21Config } from '../shared/sdk-tokens';
import { FundingExpertRequired } from './funding-expert-required';
import { SideImageProbeService } from './side-image-probe.service';
import { StartComponent } from './start.component';

/** The warning text per cause, whitespace collapsed as a reader sees it. */
const EXPECTED_TEXT: Record<ExpertRequiredCause, string> = {
  'named-assets':
    'Every coin that can fund this mint carries an inscription, rune, cat or rare sat, and this wallet keeps those on the same address as its spending money, so no coin is picked for you. Choose one below. A coin marked ⚠ asset found lists what it carries, and picking it spends those along with the coin.',
  'unnamed-assets':
    'The scan reports assets on every coin that can fund this mint but cannot say which, so no coin is picked for you. Choose one below. A coin marked ⚠ asset found carries something even where nothing is listed, and picking it spends that along with the coin.',
  'unknown-content':
    'What the coins that can fund this mint carry could not be checked, so no coin is picked for you. A coin marked scan failed may carry an inscription, rune, cat or rare sat. Press Retry scan on it to check again, or choose a coin below.',
};

/** The badge each warning points at: the picker row's own label and colours. */
const EXPECTED_BADGE: Record<ExpertRequiredCause, { text: string; classes: string[] }> = {
  'named-assets': { text: '⚠ asset found', classes: ['bg-danger-subtle', 'text-danger-emphasis'] },
  'unnamed-assets': { text: '⚠ asset found', classes: ['bg-danger-subtle', 'text-danger-emphasis'] },
  'unknown-content': { text: 'scan failed', classes: ['bg-warning-subtle', 'text-warning-emphasis'] },
};

const dummy = getDummyKeypair(toScureNetwork(Network.Regtest));
/** Watch-only identity that keeps ordinals and spending money on ONE address. */
const ONE_ADDRESS = { ordinals: dummy.addressP2TR, payment: dummy.addressP2TR };
/** Watch-only identity with a SEPARATE payment address. */
const SEPARATE = { ordinals: dummy.addressP2TR, payment: dummy.addressP2WPKH };

/** The only coin the wallet holds; covers the mint many times over. */
const COIN: TxnOutput = electrsConfirmedUtxoFixture({ txid: 'c'.repeat(64), vout: 0, value: 300_000 });
const COIN_OUTPOINT = `${COIN.txid}:${COIN.vout}`;

const VALID_SIDE = `${'a'.repeat(64)}i0`;

/** A Response the SDK's fetch helpers read: status plus a JSON body. */
function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/**
 * The network as the SDK sees it: the esplora UTXO list and fee estimate, and
 * the two ord `/output` answers for the one coin. Anything else is a request
 * this spec did not expect and fails loudly rather than hanging.
 */
function stubNetwork(payment: string, output: OutputFixture): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === `${environment.mempoolApiUrl}/api/address/${payment}/utxo`) return json([COIN]);
    if (url === `${environment.mempoolApiUrl}/api/v1/fees/recommended`) return json(recommendedFeesFixture());
    if (url === `${environment.ordApiUrl}/output/${COIN_OUTPOINT}`) return json(output.ord);
    if (url === `${environment.cat21OrdApiUrl}/output/${COIN_OUTPOINT}`) return json(output.cat21Ord);
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
  fundingAssetNotice(): boolean;
  fundingRecommendation(): InscribeSnapshot['fundingRecommendation'];
  fundingExpertCause(): ExpertRequiredCause | null;
  effectiveFundingUtxo(): TxnOutput | null;
  canMint(): boolean;
  mintFormData: { update(fn: (v: Record<string, unknown>) => Record<string, unknown>): void };
  snap: { set(s: InscribeSnapshot): void };
}

/**
 * The real StartComponent class wired the way app.config.ts wires it, with a
 * restored watch-only wallet, the six sides filled and the network answering
 * for one coin.
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
    feeRate: 10,
  }));
  TestBed.tick();
  return component;
}

/** Waits until the orchestrator has settled on a recommendation other than scanning. */
async function settledRecommendation(component: StartView): Promise<InscribeSnapshot['fundingRecommendation']> {
  await vi.waitFor(() => {
    TestBed.tick();
    const status = component.fundingRecommendation().status;
    if (status === 'scanning' || status === 'insufficient') throw new Error(`still ${status}`);
  }, { timeout: 5_000, interval: 25 });
  return component.fundingRecommendation();
}

/**
 * The warning rendered for one cause. `detectChanges`, not `whenStable`: the
 * start component in the same module keeps HTTP requests pending on purpose,
 * and those count as pending work that `whenStable` waits for.
 */
async function renderWarning(cause: ExpertRequiredCause): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(FundingExpertRequired);
  fixture.componentRef.setInput('cause', cause);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const collapsed = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The one badge inside the warning. */
function badgeOf(el: HTMLElement): Element {
  const badges = el.querySelectorAll('.badge');
  if (badges.length !== 1) throw new Error(`expected one badge in the warning, found ${badges.length}`);
  return badges[0];
}

describe('expert-required: the warning names its cause, and Mint stays disabled', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    // vitest runs the component through JIT, which cannot see an `input()`
    // field before the class is instantiated. The Angular CLI adds exactly this
    // decorator for JIT builds; the spec does the same so `setInput` reaches
    // the signal.
    Input({ isSignal: true, alias: 'cause', required: true } as never)(FundingExpertRequired.prototype, 'cause');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('named assets on a one-address wallet', () => {
    let component: StartView;

    beforeEach(async () => {
      stubNetwork(ONE_ADDRESS.payment, inscribedOutputFixture());
      component = startComponent(ONE_ADDRESS);
      await settledRecommendation(component);
    });

    it('the SDK blocks with cause named-assets', () => {
      expect(component.fundingRecommendation().status).toBe('expert-required');
      expect(component.fundingExpertCause()).toBe('named-assets');
      expect(component.fundingRecommendation().recommended?.assets?.inscriptionIds).toEqual([`${'a'.repeat(64)}i0`]);
    });

    it('Mint is disabled and no coin is picked or marked as picked', () => {
      // The SDK names a recommended coin, the component uses none of it.
      expect(component.fundingRecommendation().recommended?.txid).toBe(COIN.txid);
      expect(component.effectiveFundingUtxo()).toBeNull();
      expect(component.canMint()).toBe(false);
    });

    it('the warning says the assets share the address and points at the asset-found badge', async () => {
      const el = await renderWarning('named-assets');
      expect(collapsed(el)).toBe(EXPECTED_TEXT['named-assets']);
      const badge = badgeOf(el);
      expect(collapsed(badge)).toBe(EXPECTED_BADGE['named-assets'].text);
      expect([...badge.classList]).toEqual(expect.arrayContaining(EXPECTED_BADGE['named-assets'].classes));
    });
  });

  describe('content the scan could not check, on a separate-payment-address wallet', () => {
    let component: StartView;

    beforeEach(async () => {
      // ord answers 200 with no sat ranges for an output it has not indexed,
      // so the scan fails and the coin's content is unknown.
      stubNetwork(SEPARATE.payment, notIndexedOutputFixture());
      component = startComponent(SEPARATE);
      await settledRecommendation(component);
    });

    it('the SDK blocks with cause unknown-content even though the wallet keeps a separate payment address', () => {
      expect(component.fundingRecommendation().status).toBe('expert-required');
      expect(component.fundingExpertCause()).toBe('unknown-content');
      expect(component.fundingRecommendation().recommended?.bucket).toBe('failed');
    });

    it('Mint is disabled and no coin is picked or marked as picked', () => {
      expect(component.fundingRecommendation().recommended?.txid).toBe(COIN.txid);
      expect(component.effectiveFundingUtxo()).toBeNull();
      expect(component.canMint()).toBe(false);
    });

    it('the warning says the content is unknown, names the scan-failed badge and the retry', async () => {
      const el = await renderWarning('unknown-content');
      expect(collapsed(el)).toBe(EXPECTED_TEXT['unknown-content']);
      const badge = badgeOf(el);
      expect(collapsed(badge)).toBe(EXPECTED_BADGE['unknown-content'].text);
      expect([...badge.classList]).toEqual(expect.arrayContaining(EXPECTED_BADGE['unknown-content'].classes));
    });
  });

  /**
   * cubes' own scanner always names what it finds (a scan that detects nothing
   * nameable reads as scan-failed), so this cause reaches the page only through
   * a scan port that answers a bare `has-assets`. The SDK's own orchestrator
   * produces the snapshot from such a port, and the component reads it exactly
   * as it reads the one its own orchestrator emits.
   */
  describe('assets the scan does not name, on a separate-payment-address wallet', () => {
    let component: StartView;

    beforeEach(async () => {
      stubNetwork(SEPARATE.payment, inscribedOutputFixture());
      component = startComponent(SEPARATE);
      const unusedTransport: InscribeBroadcastTransport = {
        testPackage: async () => { throw new Error('unexpected testPackage'); },
        submitPackage: async () => { throw new Error('unexpected submitPackage'); },
        sendTransaction: async () => { throw new Error('unexpected sendTransaction'); },
      };
      const orch = new InscribeMintOrchestrator({
        getUtxos: async () => [COIN],
        scan: { classify: async () => 'has-assets' },
        transport: unusedTransport,
        network: Network.Regtest,
        fundingTopology: 'derive',
      });
      await orch.setWallet({
        type: KnownOrdinalWalletType.xpub,
        ordinalsAddress: SEPARATE.ordinals,
        paymentAddress: SEPARATE.payment,
        paymentPublicKey: hex.encode(dummy.dummyPublicKey),
      });
      orch.setFeeRate(10);
      const snapshot = await new Promise<InscribeSnapshot>((resolve) => {
        const unsub = orch.subscribe((s) => {
          const status = s.fundingRecommendation.status;
          if (s.simulations.length > 0 && status !== 'scanning' && status !== 'insufficient') {
            unsub();
            resolve(s);
          }
        });
        orch.setContent({
          source: {
            kind: 'file',
            body: new TextEncoder().encode('<html><!--cubes.haushoppe.art--><body>cube</body></html>'),
            contentType: 'text/html;charset=utf-8',
          },
        });
      });
      component.snap.set(snapshot);
    });

    it('the SDK blocks with cause unnamed-assets even though the wallet keeps a separate payment address', () => {
      expect(component.fundingRecommendation().status).toBe('expert-required');
      expect(component.fundingExpertCause()).toBe('unnamed-assets');
      expect(component.fundingRecommendation().recommended?.bucket).toBe('assets');
    });

    it('Mint is disabled and no coin is picked or marked as picked', () => {
      expect(component.fundingRecommendation().recommended?.txid).toBe(COIN.txid);
      expect(component.effectiveFundingUtxo()).toBeNull();
      expect(component.canMint()).toBe(false);
    });

    it('the warning says the scan cannot name the assets and points at the asset-found badge', async () => {
      const el = await renderWarning('unnamed-assets');
      expect(collapsed(el)).toBe(EXPECTED_TEXT['unnamed-assets']);
      const badge = badgeOf(el);
      expect(collapsed(badge)).toBe(EXPECTED_BADGE['unnamed-assets'].text);
      expect([...badge.classList]).toEqual(expect.arrayContaining(EXPECTED_BADGE['unnamed-assets'].classes));
    });
  });

  /**
   * The notice half of the ruling: the wallet keeps its spending money on a
   * separate address and the only coin carries a named inscription, so the
   * reader is told what the coin carries and the mint proceeds with it.
   */
  describe('named assets on a separate-payment-address wallet', () => {
    let component: StartView;

    beforeEach(async () => {
      stubNetwork(SEPARATE.payment, inscribedOutputFixture());
      component = startComponent(SEPARATE);
      await settledRecommendation(component);
    });

    it('the SDK answers asset-notice naming the inscription, and no warning applies', () => {
      expect(component.fundingRecommendation().status).toBe('asset-notice');
      expect(component.fundingAssetNotice()).toBe(true);
      expect(component.fundingExpertCause()).toBeNull();
      expect(component.fundingRecommendation().recommended?.assets?.inscriptionIds).toEqual([`${'a'.repeat(64)}i0`]);
    });

    it('Mint is enabled with the named-asset coin as the funding coin', () => {
      expect(component.effectiveFundingUtxo()).toMatchObject({ txid: COIN.txid, vout: COIN.vout });
      expect(component.canMint()).toBe(true);
    });

    it('the mint reaches the signature with that coin as the commit\'s only input', async () => {
      // The watch-only signature is the IO boundary: the prompt receives the
      // unsigned commit and the spec stops there, before any broadcast.
      const prompted: string[] = [];
      const stop = new Error('the spec stops at the signature');
      await expect(component.orch.mint(async ({ base64: psbt }) => {
        prompted.push(psbt);
        throw stop;
      })).rejects.toBe(stop);

      expect(prompted).toHaveLength(1);
      const commit = Transaction.fromPSBT(base64.decode(prompted[0]));
      expect(commit.inputsLength).toBe(1);
      const input = commit.getInput(0);
      expect(input.txid && hex.encode(input.txid)).toBe(COIN.txid);
      expect(input.index).toBe(COIN.vout);
    });
  });

  it('no warning on a clean auto-pick: the cause is null and Mint can proceed', async () => {
    stubNetwork(ONE_ADDRESS.payment, cleanOutputFixture());
    const component = startComponent(ONE_ADDRESS);
    await settledRecommendation(component);
    expect(component.fundingRecommendation().status).toBe('auto');
    expect(component.fundingExpertCause()).toBeNull();
    expect(component.effectiveFundingUtxo()?.txid).toBe(COIN.txid);
  });
});
