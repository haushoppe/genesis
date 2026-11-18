/**
 * @test-kind unit
 * Real:   StartComponent class through Angular DI (no template), its own esplora inscribe
 *         transport, PastMintsService, Cat21Service, UtxoContentScanner and WalletService
 *         (ordpool-sdk, constructed as in app.config.ts)
 * Faked:  fetch -> the esplora UTXO list and fee estimate, both ord `/output` answers for the
 *         one clean coin, and the broadcast POST the resend makes; the orchestrator's `mint`
 *         -> rejects with the SDK's own InscribeRevealPendingError (the collaborator at the
 *         boundary, so the component's recovery wiring is what runs); WalletService storage ->
 *         an in-memory map holding a persisted watch-only identity; environment -> the real one
 *         with loopback hosts and a regtest tip; SideImageProbeService -> every side renders
 * Proves: a mint that leaves the commit in a mempool without its reveal keeps the signed reveal
 *         and the sides it belongs to, sends exactly that reveal when the reader asks, records
 *         the mint once a node holds it, reads a node's `txn-already-in-mempool` as the success
 *         it is, and keeps the recovery for another try when the node refuses
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
  getDummyKeypair,
  InscribeMintOrchestrator,
  InscribeRevealPendingError,
  KnownOrdinalWalletType,
  LAST_CONNECTED_WALLET,
  Network,
  toScureNetwork,
  TxnOutput,
  UtxoContentScanner,
  WalletService,
} from 'ordpool-sdk';
import { electrsConfirmedUtxoFixture, recommendedFeesFixture } from 'ordpool-sdk/testing';
import { hex } from '@scure/base';

import { environment } from '../../environments/environment';
import { bitcoinNetwork, cat21Config } from '../shared/sdk-tokens';
import { PastMint, PastMintsService } from '../services/past-mints.service';
import { SideImageProbeService } from './side-image-probe.service';
import { StartComponent } from './start.component';

const dummy = getDummyKeypair(toScureNetwork(Network.Regtest));
const IDENTITY = { ordinals: dummy.addressP2TR, payment: dummy.addressP2WPKH };

/** The only coin the wallet holds; clean, and covers the mint many times over. */
const COIN: TxnOutput = electrsConfirmedUtxoFixture({ txid: 'c'.repeat(64), vout: 0, value: 300_000 });
const COIN_OUTPOINT = `${COIN.txid}:${COIN.vout}`;

const VALID_SIDE = `${'a'.repeat(64)}i0`;
const BROADCAST_URL = `${environment.mempoolApiUrl}/api/tx`;

/** The recovery the SDK hands out when the commit may be out and the reveal is not. */
const COMMIT_TXID = 'd'.repeat(64);
const REVEAL_TXID = 'e'.repeat(64);
const REVEAL_HEX = '02000000000101abcdef';

function revealPendingError(): InscribeRevealPendingError {
  return new InscribeRevealPendingError({
    commitTxId: COMMIT_TXID,
    revealTxId: REVEAL_TXID,
    commitAddress: 'bcrt1pcommitaddress',
    revealHex: REVEAL_HEX,
    ephemeral: { privKey: new Uint8Array(32).fill(7), pubkeyXonly: new Uint8Array(32).fill(8) },
    reason: 'reveal not validated',
  });
}

/** A Response the SDK's fetch helpers read: status plus a JSON body. */
function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** Every broadcast POST the resend makes, in order, with the body it sent. */
interface Broadcasts {
  bodies: string[];
  /** What the node answers next. */
  answer: () => Response;
}

/**
 * The network as the SDK sees it: the esplora UTXO list and fee estimate, both
 * ord `/output` answers for the one coin, and the broadcast endpoint. Anything
 * else is a request this spec did not expect and fails loudly.
 */
function stubNetwork(): Broadcasts {
  const broadcasts: Broadcasts = { bodies: [], answer: () => new Response(REVEAL_TXID, { status: 200 }) };
  const output = cleanOutputFixture();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === BROADCAST_URL) {
      broadcasts.bodies.push(String(init?.body ?? ''));
      return broadcasts.answer();
    }
    if (url === `${environment.mempoolApiUrl}/api/address/${IDENTITY.payment}/utxo`) return json([COIN]);
    if (url === `${environment.mempoolApiUrl}/api/v1/fees/recommended`) return json(recommendedFeesFixture());
    if (url === `${environment.ordApiUrl}/output/${COIN_OUTPOINT}`) return json(output.ord);
    if (url === `${environment.cat21OrdApiUrl}/output/${COIN_OUTPOINT}`) return json(output.cat21Ord);
    throw new Error(`unexpected request in spec: ${url}`);
  }));
  return broadcasts;
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
  canMint(): boolean;
  mint(): Promise<void>;
  resendReveal(): Promise<void>;
  revealPending(): { error: InscribeRevealPendingError; sides: string[] } | null;
  revealResendState(): 'idle' | 'sending' | 'sent' | 'failed';
  revealResendError(): string | null;
  mintAnother(): void;
  mintFormData: { update(fn: (v: Record<string, unknown>) => Record<string, unknown>): void };
}

function startComponent(): { component: StartView; pastMints: PastMintsService } {
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
      { provide: WalletService, useFactory: () => new WalletService({ storage: storageWith(IDENTITY), network: Network.Regtest }) },
      {
        provide: SideImageProbeService,
        useValue: { probe: (ids: readonly string[]) => of(Object.fromEntries(ids.map((id) => [id, 'ok']))) },
      },
    ],
  });
  const pastMints = TestBed.inject(PastMintsService);
  const component = TestBed.runInInjectionContext(() => new StartComponent()) as unknown as StartView;
  component.mintFormData.update((v) => ({
    ...v,
    inscriptionId1: VALID_SIDE, inscriptionId2: VALID_SIDE, inscriptionId3: VALID_SIDE,
    inscriptionId4: VALID_SIDE, inscriptionId5: VALID_SIDE, inscriptionId6: VALID_SIDE,
    feeRate: 10,
  }));
  TestBed.tick();
  return { component, pastMints };
}

/** A mint that reaches the broadcast and leaves the reveal behind. */
async function mintLeavingRevealPending(component: StartView): Promise<InscribeRevealPendingError> {
  await vi.waitFor(() => {
    TestBed.tick();
    if (!component.canMint()) throw new Error('mint not ready yet');
  }, { timeout: 5_000, interval: 25 });
  const error = revealPendingError();
  vi.spyOn(component.orch, 'mint').mockRejectedValue(error);
  await component.mint();
  return error;
}

describe('a reveal left behind can be sent again', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('keeps the signed reveal and the sides it was built for', async () => {
    stubNetwork();
    const { component } = startComponent();
    const error = await mintLeavingRevealPending(component);

    const pending = component.revealPending();
    expect(pending?.error).toBe(error);
    expect(pending?.error.revealHex).toBe(REVEAL_HEX);
    // The ephemeral key stays with it: it is the other half the SDK's JSDoc
    // asks a consumer to hold on to.
    expect(pending?.error.ephemeral.privKey).toEqual(new Uint8Array(32).fill(7));
    expect(pending?.sides).toEqual(Array(6).fill(VALID_SIDE));
    expect(component.revealResendState()).toBe('idle');
  });

  it('sends exactly that reveal and records the mint once a node holds it', async () => {
    const broadcasts = stubNetwork();
    const { component, pastMints } = startComponent();
    await mintLeavingRevealPending(component);

    await component.resendReveal();

    expect(broadcasts.bodies).toEqual([REVEAL_HEX]);
    expect(component.revealResendState()).toBe('sent');
    expect(component.revealResendError()).toBeNull();
    expect(pastMints.pastMints().map((m: PastMint) => ({
      commitTxId: m.commitTxId, revealTxId: m.revealTxId, inscriptionIds: m.inscriptionIds,
    }))).toEqual([
      { commitTxId: COMMIT_TXID, revealTxId: REVEAL_TXID, inscriptionIds: Array(6).fill(VALID_SIDE) },
    ]);
  });

  it('reads a node that already holds the reveal as sent, not as a failure', async () => {
    const broadcasts = stubNetwork();
    broadcasts.answer = () => new Response('sendrawtransaction RPC error: txn-already-in-mempool', { status: 400 });
    const { component, pastMints } = startComponent();
    await mintLeavingRevealPending(component);

    await component.resendReveal();

    expect(component.revealResendState()).toBe('sent');
    expect(component.revealResendError()).toBeNull();
    expect(pastMints.pastMints()).toHaveLength(1);
  });

  it('keeps the recovery for another try when the node refuses, and names the reason', async () => {
    const broadcasts = stubNetwork();
    broadcasts.answer = () => new Response('bad-txns-inputs-missingorspent', { status: 400 });
    const { component, pastMints } = startComponent();
    await mintLeavingRevealPending(component);

    await component.resendReveal();

    expect(component.revealResendState()).toBe('failed');
    expect(component.revealResendError()).toContain('bad-txns-inputs-missingorspent');
    // Nothing is recorded: no node holds the reveal, so there is no mint yet.
    expect(pastMints.pastMints()).toEqual([]);
    // The reveal is still there, so the second press sends the same bytes.
    expect(component.revealPending()?.error.revealHex).toBe(REVEAL_HEX);

    broadcasts.answer = () => new Response(REVEAL_TXID, { status: 200 });
    await component.resendReveal();
    expect(broadcasts.bodies).toEqual([REVEAL_HEX, REVEAL_HEX]);
    expect(component.revealResendState()).toBe('sent');
  });

  it('drops the recovery when the reader starts another cube', async () => {
    stubNetwork();
    const { component } = startComponent();
    await mintLeavingRevealPending(component);
    expect(component.revealPending()).not.toBeNull();

    component.mintAnother();

    expect(component.revealPending()).toBeNull();
    expect(component.revealResendState()).toBe('idle');
  });

  it('leaves a mint that fails for any other reason without a resend', async () => {
    stubNetwork();
    const { component } = startComponent();
    await vi.waitFor(() => {
      TestBed.tick();
      if (!component.canMint()) throw new Error('mint not ready yet');
    }, { timeout: 5_000, interval: 25 });
    vi.spyOn(component.orch, 'mint').mockRejectedValue(new Error('the wallet refused to sign'));

    await component.mint();

    // Nothing was broadcast, so there is nothing to send again: offering a
    // resend here would promise a recovery that does not exist.
    expect(component.revealPending()).toBeNull();
  });
});
