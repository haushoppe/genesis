// Small helpers shared across regtest E2E specs. Hits the local
// bitcoind RPC + electrs HTTP API directly — no Angular, no DI.
//
// Expects the regtest stack to be up via `e2e/regtest-bootstrap.sh`
// and `REGTEST_FUNDED_ADDR` / `REGTEST_FUNDED_WIF` set in env.

import { expect, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const ELECTRS_URL = process.env.REGTEST_ELECTRS_URL ?? 'http://localhost:3010';
const ORD_URL = process.env.REGTEST_ORD_URL ?? 'http://localhost:8080';
// Stock ord (no --index-cat21 flag) — service `ord-stock` in the SDK's
// docker-compose.regtest.yml (node_modules/ordpool-sdk/e2e/). Used by the
// `inscribe-ord-indexing-roundtrip`
// spec to verify a real upstream-ord recognises the SDK's inscriptions.
const ORD_STOCK_URL = process.env.REGTEST_ORD_STOCK_URL ?? 'http://localhost:8081';

export interface FundedAccount {
  address: string;
  wif: string;
}

export function getFundedAccount(): FundedAccount {
  const address = process.env.REGTEST_FUNDED_ADDR;
  const wif = process.env.REGTEST_FUNDED_WIF;
  if (!address || !wif) {
    throw new Error('REGTEST_FUNDED_ADDR and REGTEST_FUNDED_WIF must be set — run e2e/regtest-bootstrap.sh first');
  }
  return { address, wif };
}

/** Run a bitcoin-cli command inside the bitcoind container. */
/**
 * Pipe a `bitcoin-cli` command into the regtest container. Args go
 * through execFileSync (no shell), so JSON payloads with braces and
 * colons don't need extra escaping.
 */
export function rpc(...args: string[]): string {
  return execFileSync(
    'docker',
    ['exec', 'cubes-e2e-bitcoind', 'bitcoin-cli',
     '-regtest', '-rpcuser=ordpool', '-rpcpassword=ordpool', ...args],
    { encoding: 'utf8' },
  ).trim();
}

/** Mine N blocks to a throwaway address. Returns the new tip height. */
export function mineBlocks(n: number): number {
  const address = rpc('-rpcwallet=cubes-e2e', 'getnewaddress', '', 'legacy');
  rpc('-rpcwallet=cubes-e2e', 'generatetoaddress', String(n), address);
  return Number(rpc('getblockcount'));
}

/**
 * Fund `paymentAddr` with `amountBtc` on COMMON (mid-block) sats, then wait until
 * electrs and BOTH ord instances have indexed the coin, so the mint-time
 * funding-safety scan classifies it `clean` and the orchestrator auto-picks it.
 *
 * ord assigns a tx's input sats to its outputs FIFO by output order, and a regtest
 * coinbase's first sat is the block-first sat, which ord's rarity model reads as
 * `uncommon`. `fundrawtransaction` with `changePosition: 0` forces change to vout 0,
 * so that boundary sat is absorbed by change and the payment at vout 1 inherits
 * later, common sats. A plain `sendtoaddress` randomizes the change position and
 * drops the boundary sat onto the payment ~50% of the time -> `uncommon` ->
 * `expert-required` -> no auto-pick -> the mint stalls at a disabled button.
 *
 * A single explicit coinbase input (the largest mature coin) is selected so exactly
 * one boundary sat exists and the vout-0 change fully absorbs it.
 */
export async function fundCommonSats(paymentAddr: string, amountBtc: number): Promise<void> {
  const unspent = JSON.parse(
    rpc('-rpcwallet=cubes-e2e', 'listunspent', '100'),
  ) as Array<{ txid: string; vout: number; amount: number }>;
  const coin = [...unspent].sort((a, b) => b.amount - a.amount)[0];
  if (!coin) throw new Error('fundCommonSats: no mature coin to fund from');
  const raw = rpc(
    'createrawtransaction',
    JSON.stringify([{ txid: coin.txid, vout: coin.vout }]),
    JSON.stringify([{ [paymentAddr]: amountBtc }]),
  );
  const funded = JSON.parse(
    rpc('-rpcwallet=cubes-e2e', 'fundrawtransaction', raw, JSON.stringify({ changePosition: 0 })),
  ) as { hex: string };
  const signed = JSON.parse(
    rpc('-rpcwallet=cubes-e2e', 'signrawtransactionwithwallet', funded.hex),
  ) as { hex: string };
  rpc('-rpcwallet=cubes-e2e', 'sendrawtransaction', signed.hex);

  const tip = mineBlocks(1);
  await waitForElectrsSync(tip);
  await waitForUtxoAt(paymentAddr, Math.round(amountBtc * 1e8));
  // Both ord instances must have indexed the funding block before the mint-time
  // content scan, or /output 404s -> scan-failed -> expert-required -> no auto-pick.
  await waitForOrdStockSync(tip);
  await waitForOrdSync(tip);
}

/** Wait until electrs has indexed up to (at least) the given height. */
export async function waitForElectrsSync(targetHeight: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tipText = await fetch(`${ELECTRS_URL}/blocks/tip/height`).then(r => r.text()).catch(() => '0');
    if (Number(tipText) >= targetHeight) return;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`electrs didn't reach height ${targetHeight} within ${timeoutMs}ms`);
}

/**
 * Wait for a UTXO matching `predicate` to appear at `address`.
 * `waitForElectrsSync` only guarantees the block tip is at the
 * target height — electrs still needs additional time to index
 * that block's transactions into per-address UTXO sets. Any
 * spec that calls `getUtxos(addr)` immediately after
 * `mineBlocks(1)` + `waitForElectrsSync(tip)` is racing the
 * address-history pass.
 *
 * `description` is a short human-readable label of what the
 * predicate matches (e.g. `value=100_000_000`,
 * `txid=abc… value=100_000_000`). It surfaces in the timeout
 * error so the failure tells you which UTXO didn't show up.
 */
export async function waitForUtxoMatching(
  address: string,
  predicate: (u: ElectrsUtxo) => boolean,
  description: string,
  timeoutMs = 15_000,
): Promise<ElectrsUtxo> {
  const deadline = Date.now() + timeoutMs;
  let lastUtxos: ElectrsUtxo[] = [];
  while (Date.now() < deadline) {
    lastUtxos = await getUtxos(address);
    const hit = lastUtxos.find(predicate);
    if (hit) return hit;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(
    `UTXO matching "${description}" at ${address} didn't appear within ${timeoutMs}ms; got ${JSON.stringify(lastUtxos)}`,
  );
}

/** Common case: poll for a UTXO of exactly `expectedSats`. */
export async function waitForUtxoAt(
  address: string,
  expectedSats: number,
  timeoutMs = 15_000,
): Promise<ElectrsUtxo> {
  return waitForUtxoMatching(
    address,
    u => u.value === expectedSats,
    `value=${expectedSats}`,
    timeoutMs,
  );
}

/**
 * Wait until electrs's address-history index lists `expectedTxid`
 * against `address` (in either the spending or receiving slot).
 * Use this when you need to assert on the SAME tx from multiple
 * addresses' perspectives (e.g. confirm a redirect inscription
 * landed at B and NOT at A) — once the recipient sees the txid,
 * the sender's view is reliably up-to-date from the same
 * electrs.
 */
export async function waitForAddressTxIndexed(
  address: string,
  expectedTxid: string,
  timeoutMs = 15_000,
): Promise<void> {
  await waitForUtxoMatching(
    address,
    u => u.txid === expectedTxid,
    `txid=${expectedTxid}`,
    timeoutMs,
  );
}

export interface ElectrsUtxo {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean; block_height?: number; block_hash?: string; block_time?: number };
}

export async function getUtxos(address: string): Promise<ElectrsUtxo[]> {
  const res = await fetch(`${ELECTRS_URL}/address/${address}/utxo`);
  if (!res.ok) throw new Error(`utxo fetch failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<ElectrsUtxo[]>;
}

export async function getTxHex(txid: string): Promise<string> {
  const res = await fetch(`${ELECTRS_URL}/tx/${txid}/hex`);
  if (!res.ok) throw new Error(`tx hex fetch failed: ${res.status} ${await res.text()}`);
  return (await res.text()).trim();
}

export async function postTx(hexPayload: string): Promise<string> {
  const res = await fetch(`${ELECTRS_URL}/tx`, {
    method: 'POST',
    body: hexPayload,
  });
  const body = (await res.text()).trim();
  if (!res.ok) throw new Error(`broadcast failed (${res.status}): ${body}`);
  return body;
}

export async function getTxStatus(txid: string): Promise<{ confirmed: boolean; block_height?: number; block_hash?: string }> {
  const res = await fetch(`${ELECTRS_URL}/tx/${txid}/status`);
  if (!res.ok) throw new Error(`tx status fetch failed: ${res.status}`);
  return res.json() as Promise<{ confirmed: boolean; block_height?: number; block_hash?: string }>;
}

/**
 * Full Esplora-format transaction record. Includes the fields the
 * `ordpool-parser` Cat21ParserService consumes: `locktime`, `weight`,
 * `fee`, and `status.block_hash`.
 */
export interface EsploraTx {
  txid: string;
  version: number;
  locktime: number;
  vin: unknown[];
  vout: unknown[];
  size: number;
  weight: number;
  fee: number;
  status: { confirmed: boolean; block_height?: number; block_hash?: string; block_time?: number };
}

/**
 * Wait until electrs has CONFIRMED `txid` — i.e. the per-tx status
 * endpoint returns `confirmed: true` AND a non-empty `block_hash`.
 *
 * Why this exists separately from `waitForElectrsSync`:
 * `waitForElectrsSync` only checks the chain-tip height endpoint
 * (`/blocks/tip/height`). electrs serves that endpoint the moment
 * it sees the new block header, but the per-tx status (`/tx/:id/
 * status`) needs an extra pass to map the tx into its containing
 * block. That gap is hundreds of ms to a few seconds on a cold
 * runner. Without this helper a mint roundtrip's subsequent
 * `getTx(txid)` call intermittently returns `block_hash: undefined`
 * (iter 114 — `block_hash=undefined` race, observed flaking on
 * xverse-mint, leather-mint, and any other mint spec that
 * inspects the confirmation status).
 *
 * Polls every 200ms by default. Returns the EsploraTx once the
 * confirmation is observable; throws if the deadline is reached.
 */
export async function waitForTxConfirmed(
  txid: string,
  timeoutMs = 15_000,
): Promise<EsploraTx> {
  const deadline = Date.now() + timeoutMs;
  let lastSeen: EsploraTx | undefined;
  while (Date.now() < deadline) {
    const tx = await getTx(txid).catch(() => undefined);
    if (tx) {
      lastSeen = tx;
      if (tx.status.confirmed && tx.status.block_hash) return tx;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(
    `tx ${txid} not confirmed within ${timeoutMs}ms; ` +
    `last status: ${lastSeen ? JSON.stringify(lastSeen.status) : 'not-found'}`
  );
}

export async function getTx(txid: string): Promise<EsploraTx> {
  const res = await fetch(`${ELECTRS_URL}/tx/${txid}`);
  if (!res.ok) throw new Error(`tx fetch failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<EsploraTx>;
}


interface EsploraVin {
  witness?: string[];
  scriptsig?: string;
  prevout?: { scriptpubkey_type?: string };
  is_coinbase?: boolean;
}

/**
 * Throws unless every signed input in `tx` commits to all outputs
 * under SIGHASH_ALL semantics. Used by every cat21 mint roundtrip
 * spec — a SIGHASH_NONE / SINGLE / ANYONECANPAY signature on the
 * mint input would let a relay-or-miner-side counterparty swap the
 * outputs (and steal the cat sat) while keeping the lockTime=21
 * commitment intact.
 *
 * Encoding per BIP-341 / BIP-143 / Bitcoin legacy:
 *  - Taproot key-path (witness item 0 is the Schnorr sig):
 *      64 bytes → SIGHASH_DEFAULT (encodes identically to
 *                 SIGHASH_ALL on the wire — both commit to all
 *                 outputs; the explicit-default form is shorter)
 *      65 bytes → last byte is the sighash flag; must be 0x01
 *  - ECDSA SegWit (P2WPKH, witness item 0 is DER sig + sighash):
 *      last byte of the sig must be 0x01
 *  - Legacy P2PKH (scriptsig starts with a push of DER sig):
 *      last byte of the pushed sig must be 0x01
 */
// ─── cat21-ord helpers ───────────────────────────────────────────────
//
// Used by the multi-step `cat21-flow-roundtrip` spec for two things:
//   1. Verifying the cat's current address after each step (the spec
//      asks ord which address owns inscription <minting_tx>i0).
//   2. Producing ord's reference buy-offer PSBT for byte-comparison
//      against the SDK's `buildCat21BuyOfferPsbt` output.
//
// ord serves HTML by default; every query here sends
// `Accept: application/json` to get structured output. ord recognises
// the inscription path by id (`<txid>i<index>`); for cat21 fake-
// inscriptions, the index is always 0.

/** Build a cat21 inscription id from its minting txid. */
export function catInscriptionId(mintTxid: string): string {
  return `${mintTxid}i0`;
}

/**
 * Poll ord's HTTP server until it answers `/status` with a 2xx — the
 * binary takes a moment to warm its index before binding. The compose
 * file has no healthcheck because the slim runtime image lacks wget/curl,
 * so the test bootstrap polls here.
 */
export async function waitForOrdReady(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await fetch(`${ORD_URL}/status`).then(r => r.ok).catch(() => false);
    if (ok) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`ord didn't respond on /status within ${timeoutMs}ms`);
}

/**
 * Block until ord has indexed up to (at least) `targetHeight`. ord's
 * indexer is one step behind electrs/bitcoind — it sees the new block
 * via ZMQ or polling and runs its CAT-21 filter on every tx. Without
 * this gate the cat-state assertions race the indexer.
 */
export async function waitForOrdSync(targetHeight: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await fetch(`${ORD_URL}/status`, {
      headers: { Accept: 'application/json' },
    }).then(r => r.ok ? r.json() : null).catch(() => null) as { height?: number } | null;
    if (status && typeof status.height === 'number' && status.height >= targetHeight) return;
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`ord didn't reach height ${targetHeight} within ${timeoutMs}ms`);
}

export interface OrdInscription {
  /** Address currently holding the inscription (the "owner"). */
  address: string;
  /**
   * Where the inscription sits, in `<txid>:<vout>:<offset>` form
   * (ord's `SatPoint` serialisation). The `<txid>:<vout>` prefix
   * IS the UTXO; the `<offset>` is the sat offset inside that UTXO
   * (always `0` for cats since they sit on the first sat of vout[0]).
   *
   * Note: ord's `/inscription/<id>` JSON has NO `output` field —
   * `satpoint` is the canonical location identifier. The HTML page
   * rendering shows an `output` field as `<txid>:<vout>` for human
   * readability; it's not in the API response.
   */
  satpoint: string;
  /** Sat number on which the inscription sits. */
  sat?: number | null;
  /** Sats locked in the inscription's UTXO. */
  value: number;
  /** ord's inscription number (= cat number under --index-cat21). */
  number: number;
  /** The inscription id, `<txid>i<index>`. */
  id: string;
}

/**
 * Fetch a cat's inscription record from ord. Returns the owner address,
 * current UTXO, and other ord-side state. Throws on any non-2xx — the
 * caller passes through after asserting on shape.
 */
export async function getOrdInscription(inscriptionId: string): Promise<OrdInscription> {
  const res = await fetch(`${ORD_URL}/inscription/${inscriptionId}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`ord /inscription/${inscriptionId} returned ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<OrdInscription>;
}

/**
 * Wait until ord reports the cat at `inscriptionId` is owned by
 * `expectedAddress`. Polls every 300ms; throws on timeout with the
 * last-observed owner.
 *
 * Use this after each broadcast + confirm step in the multi-step spec
 * to assert the cat actually moved where the SDK said it would.
 */
export async function waitForCatAtAddress(
  inscriptionId: string,
  expectedAddress: string,
  timeoutMs = 30_000,
): Promise<OrdInscription> {
  const deadline = Date.now() + timeoutMs;
  let lastSeen: OrdInscription | undefined;
  while (Date.now() < deadline) {
    const insc = await getOrdInscription(inscriptionId).catch(() => undefined);
    if (insc) {
      lastSeen = insc;
      if (insc.address === expectedAddress) return insc;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(
    `cat ${inscriptionId} not at ${expectedAddress} within ${timeoutMs}ms; ` +
    `last owner: ${lastSeen?.address ?? 'unknown'}`
  );
}

/**
 * Invoke ord's CLI inside the regtest container. Returns stdout
 * trimmed. Errors bubble up via execFileSync's non-zero-exit throw.
 *
 * The container's `command:` runs `ord ... server ...`; this helper
 * spawns a SECOND ord process via `docker exec` for one-shot wallet
 * commands. Both processes read the same regtest bitcoind + index dir,
 * so wallet operations are immediately visible to the running server.
 */
export function ordCli(...args: string[]): string {
  return execFileSync(
    'docker',
    [
      'exec', 'cubes-e2e-cat21-ord',
      'ord',
      '--regtest',
      '--index-cat21',
      '--index-sats',
      '--index-addresses',
      '--bitcoin-rpc-url=bitcoind:18443',
      '--bitcoin-rpc-username=ordpool',
      '--bitcoin-rpc-password=ordpool',
      '--data-dir=/data',
      ...args,
    ],
    { encoding: 'utf8' },
  ).trim();
}

/**
 * `ord wallet …` requires `--name <NAME>` + `--server-url <URL>` on the
 * wallet subcommand (NOT global). Inside the container the running
 * ord-server is reachable at localhost:8080.
 */
function ordWalletCli(walletName: string, ...subcommandArgs: string[]): string {
  return ordCli(
    'wallet',
    '--name', walletName,
    '--server-url', 'http://localhost:8080',
    ...subcommandArgs,
  );
}

/**
 * Reference buy-offer producer. Asks ord to construct a buyer-side
 * offer for `inscriptionId` at `amountSats`. Returns the PSBT in
 * base64 form, ready for byte-comparison against the SDK's
 * `buildCat21BuyOfferPsbt` output (modulo the `lockTime=21` we set —
 * ord uses `LockTime::ZERO`, we set `21` for the cherry-on-top bonus
 * mint).
 *
 * The ord wallet must be initialised (`ordCreateWallet`) and funded
 * before this is called.
 */
export interface OrdOfferCreateOutput {
  psbt: string;          // base64
  inscription: string;   // inscription id
  seller_address: string;
}

export function ordCreateOffer(
  inscriptionId: string,
  amountSats: number,
  feeRateSatPerVb: number,
  wallet = 'ord',
): OrdOfferCreateOutput {
  const stdout = ordWalletCli(
    wallet,
    'offer', 'create',
    '--inscription', inscriptionId,
    '--amount', `${amountSats}sat`,
    '--fee-rate', String(feeRateSatPerVb),
  );
  return JSON.parse(stdout) as OrdOfferCreateOutput;
}

export interface OrdAddressResponse {
  address: string;
}

/**
 * Create + restore (idempotent) an ord-side bitcoin wallet. ord stores
 * the wallet inside the regtest bitcoind via `wallet_process_psbt`-
 * shaped RPCs; this helper exists so the test setup can construct one
 * deterministically before mining funding blocks to it.
 *
 * Returns a fresh receive address from the wallet.
 */
export function ordCreateWallet(name = 'ord'): string {
  // ord's `wallet create` is idempotent only on the wallet's existence;
  // we ignore the "wallet already exists" error path so the helper can
  // be called from a clean spec setup or a re-run.
  try {
    ordWalletCli(name, 'create');
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (!msg.includes('already exists') && !msg.includes('already loaded')) throw e;
  }
  const stdout = ordWalletCli(name, 'receive');
  const parsed = JSON.parse(stdout) as { addresses?: string[]; address?: string };
  if (parsed.address) return parsed.address;
  if (parsed.addresses && parsed.addresses.length > 0) return parsed.addresses[0];
  throw new Error(`unexpected ord wallet receive shape: ${stdout}`);
}

export function assertAllInputsSighashAll(tx: EsploraTx): void {
  for (let i = 0; i < tx.vin.length; i++) {
    const input = tx.vin[i] as EsploraVin;
    if (input.is_coinbase) continue;
    const witness = input.witness ?? [];
    if (witness.length > 0) {
      const sigHex = witness[0];
      const isTaproot = input.prevout?.scriptpubkey_type === 'v1_p2tr';
      if (isTaproot) {
        if (sigHex.length === 128) continue;
        if (sigHex.length === 130) {
          const flag = sigHex.slice(-2);
          if (flag === '01') continue;
          throw new Error(`Input ${i}: Taproot sighash flag 0x${flag} (expected 0x01 = SIGHASH_ALL)`);
        }
        throw new Error(`Input ${i}: Taproot sig wrong length ${sigHex.length / 2} bytes (expected 64 or 65)`);
      }
      const flag = sigHex.slice(-2);
      if (flag !== '01') throw new Error(`Input ${i}: SegWit sighash flag 0x${flag} (expected 0x01 = SIGHASH_ALL)`);
    } else if (input.scriptsig) {
      const ss = input.scriptsig;
      const pushLen = parseInt(ss.slice(0, 2), 16);
      const sigEnd = (1 + pushLen) * 2;
      const sigHex = ss.slice(2, sigEnd);
      const flag = sigHex.slice(-2);
      if (flag !== '01') throw new Error(`Input ${i}: Legacy sighash flag 0x${flag} (expected 0x01 = SIGHASH_ALL)`);
    }
  }
}

// ─── stock-ord helpers (no --index-cat21) ────────────────────────────
//
// Used by `inscribe-ord-indexing-roundtrip.spec.ts` to verify that
// a real upstream-style ord recognises the SDK's inscriptions. The
// cat21-ord container above runs with --index-cat21 which filters
// out regular inscriptions; stock ord indexes them like upstream.

/** Build an inscription id from txid + output index (`<txid>i<index>`). */
export function inscriptionId(txid: string, index = 0): string {
  return `${txid}i${index}`;
}

/**
 * Poll stock ord's HTTP server until it answers `/status` with a
 * 2xx. Same warm-up rationale as `waitForOrdReady`.
 */
export async function waitForOrdStockReady(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await fetch(`${ORD_STOCK_URL}/status`).then(r => r.ok).catch(() => false);
    if (ok) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`stock ord didn't respond on /status within ${timeoutMs}ms (is the ord-stock profile up?)`);
}

/**
 * Block until stock ord has indexed up to (at least) `targetHeight`.
 * ord's indexer lags bitcoind by a few hundred ms; without this gate
 * the inscription-lookup assertions race the indexer.
 */
export async function waitForOrdStockSync(targetHeight: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await fetch(`${ORD_STOCK_URL}/status`, {
      headers: { Accept: 'application/json' },
    }).then(r => r.ok ? r.json() : null).catch(() => null) as { height?: number } | null;
    if (status && typeof status.height === 'number' && status.height >= targetHeight) return;
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`stock ord didn't reach height ${targetHeight} within ${timeoutMs}ms`);
}

export interface StockOrdInscription {
  /** Address currently holding the inscription. */
  address: string;
  /** UTXO carrying the inscription, `<txid>:<vout>` form. */
  output: string;
  /** Sats locked in the inscription's UTXO. */
  value: number;
  /** ord's inscription number (sequential per stock-ord index). */
  number: number;
  /** The inscription id, `<txid>i<index>`. */
  id: string;
  /** Content-type recorded in the envelope (e.g. 'text/plain;charset=utf-8'). */
  content_type?: string | null;
  /** Body length in bytes — useful for size assertions. */
  content_length?: number | null;
}

/**
 * Fetch an inscription record from stock ord. Throws on any non-2xx;
 * callers wrap in `waitForOrdStockInscription` if they need to poll.
 */
export async function getStockOrdInscription(id: string): Promise<StockOrdInscription> {
  const res = await fetch(`${ORD_STOCK_URL}/inscription/${id}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`stock ord /inscription/${id} returned ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<StockOrdInscription>;
}

/**
 * Fetch the raw body bytes of an inscription from stock ord's
 * `/content/<id>` endpoint. ord returns the bytes verbatim with the
 * envelope's content-type as the response Content-Type header — same
 * shape every recursive-inscription consumer sees.
 */
export async function getStockOrdContent(
  id: string,
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const res = await fetch(`${ORD_STOCK_URL}/content/${id}`);
  if (!res.ok) {
    throw new Error(`stock ord /content/${id} returned ${res.status}: ${await res.text()}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return { bytes: buf, contentType: res.headers.get('content-type') };
}

/**
 * Poll until stock ord serves the inscription. ord indexes inscriptions
 * one or two blocks after the reveal lands; this helper hides the
 * polling boilerplate.
 */
export async function waitForOrdStockInscription(
  id: string,
  timeoutMs = 30_000,
): Promise<StockOrdInscription> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await getStockOrdInscription(id);
    } catch (e) {
      lastError = e;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(
    `stock ord did not surface inscription ${id} within ${timeoutMs}ms; ` +
    `last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/**
 * Force-open a `<details>` element identified by its `data-testid`.
 * The mint UI hides fee-rate + UTXO controls and the six-side inputs
 * behind collapsed `<details>` for normal users; specs that drive
 * those controls must open the disclosure first, otherwise
 * `.fill()` throws on inputs whose ancestor `display: none` makes
 * them non-actionable.
 */
/** When `configurator-advanced` was last opened, per page, for the gap below. */
const detailsOpenedAt = new WeakMap<Page, number>();

export async function openDetails(page: Page, testId: string): Promise<void> {
  await page.locator(`[data-testid="${testId}"]`).evaluate(
    (el: HTMLDetailsElement) => { el.open = true; },
  );
  if (testId === 'configurator-advanced') detailsOpenedAt.set(page, Date.now());
}

/**
 * Six mainnet inscriptions that render as images (the BitcoinOneZero digits
 * 1 to 6, image/png), for the sides of the cube the specs mint. The mint
 * form loads every side as an <img> from mainnet content before it enables
 * Mint (`environment.sideImageProbeBase`), so the sides must be real
 * renderable inscriptions, not placeholder ids; the cube body itself is
 * still minted on regtest.
 */
export const RENDERABLE_SIDE_IDS = [
  'df58fbb44dbb2a9b17405f944c8ff966fd120cccda87873f3206f012ea239bebi0',
  'ad8d751046787e22a0ef89a15b7f0e5eedae927a488a8ecc7e30711a7692fb11i0',
  'fe4e588430b19d6e8b81005a3515a0f634fb3cd3b3bdf372bc7b12b50e302acci0',
  '9825f7f09818f0adb7d3b20a4db6aa92f9af850bd4e0597db6b7ade3790b0f5bi0',
  '412cb15b19496075ef9afbd07fbabe6d6e08461c30845fafe4ece083fd20d84fi0',
  '81c64b1c7dfa8ce4e9e32dbcf68fbb51e004fb56be5b2253c880cd833ae74bcai0',
];

/** A mainnet inscription whose body is JSON: loads with 200, never decodes as an image. */
export const NON_IMAGE_SIDE_ID = 'a1aff8c3dc8ff01c775d3de7400ec6734b5fd289e8cff33b3fed8cd7da422fafi1';

/**
 * Whether a browser console error is one this regtest run legitimately
 * produces, judged by WHAT FAILED rather than by the status class.
 *
 * The difference matters. Ignoring every 404 and every 5xx also swallows a
 * broken API call, a missing chunk and a dead asset, which is precisely what a
 * console check exists to notice. Filtering by the failing resource's URL
 * keeps the noise out and leaves the signal in: narrowing this way immediately
 * surfaced a fee-endpoint 404 that the blanket version had been hiding.
 *
 * The three expected classes, each for a stated reason:
 *
 *   - `/content/` and `/preview/`: the cubes are minted with MAINNET side ids,
 *     because those are the ones that render, and the app then asks the
 *     REGTEST content host for them. They must 404; the inscriptions do not
 *     exist on this chain.
 *   - `/assets/`: the preview iframe is null-origin, so any asset it pulls
 *     fails by construction.
 *   - `/api/v1/fees/recommended`: on regtest `/api/*` proxies to electrs,
 *     which serves the esplora surface and not mempool's v1 endpoints. The app
 *     is built to degrade to absence here, so its absence is designed
 *     behaviour. A spec that stubs this endpoint will never see it.
 *
 * Non-resource noise (SDK logs, an orchestrator's per-UTXO simulation
 * complaint, a CORS refusal) stays matched on text, since those carry no URL.
 */
const EXPECTED_MISSING_URL = [
  '/content/',
  '/preview/',
  '/assets/',
  '/api/v1/fees/recommended',
];

const EXPECTED_CONSOLE_TEXT: RegExp[] = [
  /^\[sdk:/,
  /\[inscribe-mint-orchestrator\] simulation threw for utxo/,
  /has been blocked by CORS policy/,
];

export function isExpectedConsoleError(text: string, url: string): boolean {
  if (url && EXPECTED_MISSING_URL.some((part) => url.includes(part))) return true;
  return EXPECTED_CONSOLE_TEXT.some((re) => re.test(text));
}

/**
 * The cube mint pays a fixed tip to an address the minter does not control.
 * Nothing else in the suite looks at it, so a build that dropped the tip, paid
 * the wrong address or paid the wrong amount would still produce a valid cube,
 * still index byte-for-byte, and still pass every wallet lane.
 *
 * Asserted per wallet rather than once, because the app only BUILDS the
 * transaction: the wallet signs it, and a wallet that rewrites outputs is not
 * hypothetical here. Xverse's Accelerate feature rewrote an unconfirmed CAT-21
 * mint and dropped its nLockTime=21, which is the same failure shape applied to
 * a different field.
 *
 * The two values are literals owned by the test, never imported from
 * `environment.regtest.ts`. Importing them would compare the app's output
 * against the app's own input, so changing the tip would move both sides
 * together and leave this green. They live here rather than in eight specs so
 * that one edit updates them, which is safe precisely because this file is not
 * the code under test.
 */
const TIP_ADDRESS = 'bcrt1pgnmqsy3m04999vwvczfuuualuptlcwnlqx7yrf7y2xwzyswdxpvq92zqwq';
const TIP_SATS = 1000;

/**
 * Assert the tip was paid exactly once across the commit and reveal pair.
 * Spans both because either may legitimately carry it; requiring EXACTLY one
 * match means a tip paid twice fails as loudly as a tip not paid at all.
 */
export function expectTipPaid(commitTx: EsploraTx, revealTx: EsploraTx): void {
  const toTip = [...commitTx.vout, ...revealTx.vout]
    .map((o) => o as { scriptpubkey_address?: string; value?: number })
    .filter((o) => o.scriptpubkey_address === TIP_ADDRESS);

  // Exactly ONE output reaches the tip address, and it is the tip. The second
  // half pins the ABSENCE of a fixture collision, which is the thing that
  // cannot be seen by looking: the tip address used to be the Leather test
  // wallet's own ordinals address, so the cube's 546-sat postage landed here
  // too and a tip wrongly paid to the connected wallet read as correct. The
  // address above is derived from a passphrase no wallet seed reaches, and
  // this assertion fails the moment someone reintroduces a convenient one.
  expect(
    toTip.map((o) => o.value),
    `expected exactly one ${TIP_SATS}-sat tip to ${TIP_ADDRESS} and nothing else. ` +
    `More than one output here means the tip address collides with an address ` +
    `the wallet itself owns, which blinds this assertion.`,
  ).toEqual([TIP_SATS]);
}

/**
 * Open the connected-wallet popover and return once its contents are on screen.
 *
 * The trigger is a toggle, and the wallet row re-renders as the wallet's state
 * settles after a connect or a reload. A click that lands on the node being
 * replaced is swallowed: the popover never opens, and the spec fails on the
 * address element rather than on the click, which reads like a missing element
 * instead of a lost click. Re-clicking until the content appears is what makes
 * it deterministic; a single click is correct only if the timing happens to be.
 *
 * Deliberately does NOT swallow the end state: if the popover never opens
 * within the budget, the caller's own expectation fails as it would have.
 */
export async function openWalletPopover(page: Page, timeoutMs = 20_000): Promise<void> {
  const trigger = page.locator('[data-testid="wallet-connected-btn"]');
  const content = page.locator('[data-testid="wallet-popover-payment-address"]');
  const deadline = Date.now() + timeoutMs;

  await trigger.waitFor({ state: 'visible', timeout: timeoutMs });
  let clicks = 0;
  while (Date.now() < deadline) {
    if (await content.isVisible().catch(() => false)) {
      if (clicks > 1) console.log(`[openWalletPopover] opened only after ${clicks} clicks`);
      return;
    }
    clicks += 1;
    await trigger.click().catch(() => undefined);
    // waitFor, NOT isVisible({timeout}). `isVisible` takes no timeout and
    // answers instantly, so the old code checked before the popover had
    // rendered, looped, and clicked again — which TOGGLED THE POPOVER SHUT.
    // The retry counts that produced were this helper opening and closing it,
    // not a control ignoring clicks.
    if (await content.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false)) {
      if (clicks > 1) console.log(`[openWalletPopover] opened only after ${clicks} clicks`);
      return;
    }
  }
}

/**
 * Read an address out of the connected-wallet popover, re-opening if it closes.
 *
 * `openWalletPopover` makes OPENING deterministic; reading is still two steps,
 * and the wallet row re-renders as its state settles, so an element that passed
 * `toBeVisible` can be gone by the time `getAttribute` runs. That surfaces as a
 * getAttribute timeout on a locator the previous line just asserted visible,
 * which reads like a Playwright fault and is a re-render.
 *
 * The VISIBLE text is elided in the middle, so the address comes from `title`.
 */
export async function readWalletPopoverAddress(
  page: Page,
  testId: 'wallet-popover-payment-address' | 'wallet-popover-ordinals-address',
  timeoutMs = 30_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    await openWalletPopover(page, Math.max(2_000, deadline - Date.now()));
    last = (await page.locator(`[data-testid="${testId}"]`).getAttribute('title').catch(() => null))?.trim() ?? '';
    if (last.length > 0) return last;
  }
  throw new Error(`could not read ${testId} within ${timeoutMs}ms (last value: "${last}")`);
}

/**
 * Click the top-level mint CTA until the checkout drawer is actually open.
 *
 * Same shape as `openWalletPopover`: the CTA's own disabled state depends on a
 * probe that resolves asynchronously, so the button can be re-rendered around
 * the moment it is clicked and the click is swallowed. The spec then fails on
 * `mint-btn` not existing, which reads as a missing element and is a lost
 * click. One click is correct only when the timing happens to be.
 */
export async function openMintCheckout(page: Page, timeoutMs = 60_000): Promise<void> {
  const cta = page.locator('[data-testid="mint-cta"]');
  const drawer = page.locator('[data-testid="mint-checkout"]');
  const deadline = Date.now() + timeoutMs;

  await expect(cta).toBeEnabled({ timeout: timeoutMs });
  let attempts = 0;
  while (Date.now() < deadline) {
    if (await drawer.isVisible().catch(() => false)) {
      // Reported, never swallowed. A helper that retries in silence makes a
      // genuinely broken control look merely slow, and then nobody ever learns
      // which one it was. If this line appears, the first click did NOT open the
      // drawer and that is a defect to chase, not a harness detail.
      if (attempts > 1) console.log(`[openMintCheckout] drawer opened only after ${attempts} clicks`);
      return;
    }
    attempts += 1;
    await cta.click().catch(() => undefined);
    if (await drawer.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
      if (attempts > 1) console.log(`[openMintCheckout] drawer opened only after ${attempts} clicks`);
      return;
    }
  }
  await expect(drawer, 'the checkout drawer never opened').toBeVisible({ timeout: 1_000 });
}

/**
 * Is this element on screen within `ms`, tolerating that it may never appear?
 *
 * The obvious spelling, `locator.isVisible({ timeout })`, does NOT wait: the
 * option is declared, marked deprecated-and-ignored, still typechecks, and
 * reads to every reviewer as a bounded wait. So an optional dialog that has not
 * rendered yet reports absent, the dismissal is skipped, and the next click
 * lands on the overlay that was about to appear.
 *
 * `waitFor` is not a drop-in here, because it throws when the element
 * legitimately never appears, which for an optional promo is the normal
 * outcome. This waits properly and answers false instead of throwing.
 */
export async function isVisibleWithin(locator: Locator, ms: number): Promise<boolean> {
  return locator.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);
}

/**
 * Fill the side inputs, confirm each value STUCK, and characterise whatever
 * clobbered one if something did.
 *
 * The BASELINE, measured in CI (`genesis` a6141d6, 23 occurrences across one
 * green matrix run): the suggestion routinely lands on the still-blank form
 * BEFORE the loop types anything, so at "after side 1" sides 2 to 6 already
 * hold suggestion ids and side 1 holds ours. That is the guard working as
 * designed, it happens constantly, and it must stay silent.
 *
 * The DEFECT has the opposite shape: a side the loop has ALREADY typed comes
 * back holding something else. Twice in CI that was side 1, with sides 2 to 5
 * the spec's own, which against the baseline above reads as the fill of side 1
 * never taking rather than as a writer picking one field out of six. A fill
 * that lands while the control re-renders under it does not stick, and the
 * suggestion's whole-form write IS a re-render of all six fields.
 *
 * So the gate is "an already-typed side deviates", never "anything deviates".
 * When it trips, the untyped sides decide the one thing they can: whether the
 * suggestion's write was CONCURRENT. Holding ids means it landed in this
 * window and the lost fill needs no further explanation; blank means it did
 * not, and something else re-rendered or wrote. They do not establish that a
 * writer of some shape exists, because a lost fill has no writer at all.
 * The reading only exists during the first pass, so it is scoped to it: once
 * the loop has refilled sides 2 to 6 the two cases are indistinguishable,
 * which is exactly the misreading the CI artifacts invited.
 *
 * It is not the suggestion effect reading a lagging form signal.
 * `@angular/forms/signals` writes the model inside the `input` event
 * (`nativeControlCreate` -> `parser.setRawValue` -> `controlValue.set` ->
 * `debounceSync()`, whose only `await` sits behind `if (debouncer)`, and no
 * field or ancestor here declares one), so it reaches `sync()` synchronously
 * and no effect can interleave.
 */
export async function fillCubeSides(page: Page, ids: readonly string[]): Promise<void> {
  const readAll = () =>
    Promise.all(ids.map((_, i) =>
      page.locator(`[data-testid="cube-side-${i + 1}"]`).inputValue().catch(() => '')));

  /**
   * Report only if a side at or before `typedUpTo` lost its typed value; the
   * untyped sides are context for the verdict, never a reason to speak.
   * `typedUpTo` of -1 means the whole set has been typed.
   */
  const reportClobber = async (values: string[], typedUpTo: number, when: string): Promise<boolean> => {
    const last = typedUpTo < 0 ? ids.length - 1 : typedUpTo;
    const clobbered = values
      .map((v, i) => ({ i, v }))
      .filter(({ i, v }) => i <= last && v !== ids[i]);
    if (clobbered.length === 0) return false;

    for (const { i, v } of clobbered) {
      console.log(`[fillCubeSides] ${when}: side ${i + 1} holds "${v}", typed "${ids[i]}"`);
    }
    for (const { i } of clobbered) {
      const same = await sameNode(i);
      console.log(`[fillCubeSides] ${when}: side ${i + 1} is ` + (
        same === null ? 'of unknown node identity'
          : same ? 'the SAME DOM node, so a write or a clobber, not a rebuild'
            : 'a DIFFERENT DOM node, so the element was REPLACED and no write ever happened'));
    }
    if (typedUpTo >= 0) {
      const untyped = ids.length - 1 - last;
      const untypedFilled = values.filter((v, i) => i > last && v !== '').length;
      // What the untyped sides can decide is whether the SUGGESTION's
      // whole-form write was concurrent with the lost fill, not that some
      // writer of a given shape exists. A fill can simply fail to take when
      // the control re-renders under it, and then there is no writer at all.
      console.log(
        `[fillCubeSides] ${when}: ${clobbered.length} typed side(s) lost their value, ` +
        `${untypedFilled} of ${untyped} not-yet-typed side(s) hold ids -> ` +
        (untypedFilled > 0
          ? 'the suggestion\'s whole-form write landed in this window, so the lost fill is consistent with a re-render of all six'
          : 'NO suggestion write in this window, so something else re-rendered or wrote'));
    }
    return true;
  };

  // Characterise the first clobber once: the signal is the moment it happens,
  // and repeating it for every later side buries it.
  let characterised = false;

  // The six input NODES as they are before any typing. If a value vanishes
  // because its element was replaced, no write ever happened and no write
  // inventory could have found it. Template reading says these views are
  // never recreated (`@for` over a module constant, no conditional ancestor),
  // but template reading is what nearly produced the opposite conclusion, so
  // this answers it empirically instead.
  const nodesBefore = await Promise.all(ids.map((_, i) =>
    page.locator(`[data-testid="cube-side-${i + 1}"]`).elementHandle()));

  /** Is side `i` still the same DOM node it was before the loop started? */
  const sameNode = async (i: number): Promise<boolean | null> => {
    const before = nodesBefore[i];
    if (!before) return null;
    return page.locator(`[data-testid="cube-side-${i + 1}"]`)
      .evaluate((el, prev) => el === prev, before)
      .catch(() => null);
  };

  const openedAt = detailsOpenedAt.get(page);
  let gapToFirstFill: number | null = null;


  for (let attempt = 0; attempt < 3; attempt++) {
    for (let i = 0; i < ids.length; i++) {
      if ((await readAll())[i] !== ids[i]) {
        await page.locator(`[data-testid="cube-side-${i + 1}"]`).fill(ids[i]);
      }
      // Every verified loss so far has been side 1 and only side 1, three for
      // three, which is not the shape of a writer landing at a random moment.
      // Whatever it is happens once and is over before side 2. So record how
      // long after the panel opened the first fill completed, and print it on
      // losing AND surviving passes: if losses cluster at short gaps, the
      // window is the first moments after opening and can be placed instead of
      // waited for.
      if (attempt === 0 && i === 0 && openedAt !== undefined) {
        gapToFirstFill = Date.now() - openedAt;
      }
      if (attempt === 0 && !characterised) {
        characterised = await reportClobber(await readAll(), i, `after side ${i + 1}`);
      }
    }
    const lostThisPass = await reportClobber(await readAll(), -1, `attempt ${attempt + 1}`);
    if (attempt === 0 && gapToFirstFill !== null) {
      console.log(`[fillCubeSides] open->side1 gap ${gapToFirstFill}ms, ` +
        (lostThisPass ? 'a side was LOST' : 'all sides held'));
    }
    if (!lostThisPass) {
      if (attempt > 0) console.log(`[fillCubeSides] sides settled on attempt ${attempt + 1}`);
      return;
    }
  }
  throw new Error(`side inputs did not hold the typed ids after 3 attempts: ${JSON.stringify(await readAll())}`);
}

/**
 * Record every request the browser failed to complete, so a bare
 * `Uncaught (in promise) TypeError: Failed to fetch` can be attributed.
 *
 * A `pageerror` from a rejected fetch carries no URL, which makes the most
 * common browser error in this suite undiagnosable: twice now a lane has died
 * on exactly that line while the dev server logged `read ECONNRESET` beside it
 * (alby on `95aa368`, watchonly on `7c4e119`), and there was no way to tell
 * from the failure whether the fetch was the app talking to its own dev server
 * or to a real upstream.
 *
 * This deliberately does NOT widen what the specs tolerate. The returned
 * reader is meant to be appended to a message that is already being thrown, so
 * a failing gate says WHICH requests failed, and nothing that passes today
 * starts failing. Deciding that some of these are harness noise is a separate
 * decision, and it needs this evidence first.
 */
export function trackRequestFailures(page: Page): () => string[] {
  const failures: string[] = [];
  page.on('requestfailed', (r) => {
    failures.push(`${r.failure()?.errorText ?? 'failed'} ${r.method()} ${r.url()}`);
  });
  return () => failures.length
    ? ['', 'requests that failed in this page (context for any "Failed to fetch" above):', ...failures.map((f) => `  - ${f}`)]
    : [];
}
