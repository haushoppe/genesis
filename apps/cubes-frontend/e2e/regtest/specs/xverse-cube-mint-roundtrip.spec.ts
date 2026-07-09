import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { getCubeHtml } from '../../../src/app/services/cube-html';
import { parseCube } from '../../../src/shared/ordinals/parse-cube';
import {
  waitForElectrsSync,
  waitForUtxoAt,
  waitForTxConfirmed,
  rpc,
  mineBlocks,
  postTx,
  waitForOrdStockSync,
  getStockOrdContent,
} from '../regtest-helpers';
import { waitForApprovalPopup } from '../approval-popup';

/**
 * Full user-flow proof for the Xverse wallet: the actual cubes-frontend
 * UI, wired against the regtest stack (bitcoind + electrs + ord-stock).
 * Nothing about the mint path is mocked — the wallet .crx is real, the
 * chain is real, the ord instance is real, the cube HTML that gets
 * inscribed is the exact HTML the on-page iframe preview renders.
 *
 * Flow:
 *   1. beforeAll: clone the Xverse seed user-data-dir (populated once
 *      per suite by global-setup.ts), launch headed Chromium with the
 *      unpacked Xverse .crx, extract the extension id from the SW URL.
 *   2. Test: unlock Xverse; navigate to cubes-frontend at :4203; click
 *      the Connect Xverse link; approve the connect popup; assert the
 *      "Connected as bcrt1p…" appears in the DOM.
 *   3. Fund the payment address via bitcoin-cli; mine + electrs-sync.
 *   4. Fill six inscription IDs (any valid txid+i+idx shape works;
 *      ord doesn't check they exist) + a fee rate.
 *   5. Snapshot the exact cube HTML the iframe preview will inscribe.
 *   6. Click Mint. Approve the sign popup. Await the on-page success
 *      alert; parse the commit + reveal txids from it.
 *   7. Mine 1 block per tx so both confirm. Wait for ord-stock to
 *      catch up.
 *   8. Fetch `ord/inscription/<revealId>i0`; assert it's indexed.
 *      Fetch `ord/content/<id>`; byte-compare against the snapshot;
 *      round-trip through parseCube — the parsed inscriptionIds
 *      must match what the form was filled with.
 *
 * If step 8 succeeds, we've proved: user clicked → wallet signed →
 * chain accepted → ord indexed → the bytes on-chain are a real cube.
 */

const EXT_PATH = path.resolve(__dirname, '../extensions/xverse');
const RESULTS_DIR = path.resolve(__dirname, '../../../test-results-regtest');
const CUBES_URL = 'http://localhost:4203/';
const TEST_PASSWORD = 'TestPassword123!';
const SEED_USER_DATA_DIR = process.env.XVERSE_SEED_USER_DATA_DIR
  ?? path.resolve(__dirname, '../../../test-results-regtest/xverse-seed-user-data-dir');

/**
 * ~200k sats — comfortably covers postage (546) + reveal fee + tip
 * (1000) + commit fee at 5 sat/vB with plenty of headroom for the
 * change output to clear the P2TR dust floor (330 sat).
 */
const FUND_AMOUNT_BTC = 0.002;

/**
 * Six valid-format inscription IDs. ord's cube-parser walks the HTML
 * without dereferencing the /content/<id> URLs, so these don't need
 * to point at real ord inscriptions on regtest — they only need to
 * be valid txid+i+idx strings that pass isValidInscriptionId().
 */
const CUBE_SIDE_IDS = [
  'a'.repeat(64) + 'i0',
  'b'.repeat(64) + 'i0',
  'c'.repeat(64) + 'i0',
  'd'.repeat(64) + 'i0',
  'e'.repeat(64) + 'i0',
  'f'.repeat(64) + 'i0',
];

let context: BrowserContext;
let extensionId: string;

async function shot(p: Page, name: string): Promise<void> {
  await p.screenshot({
    path: path.resolve(RESULTS_DIR, `xverse-cube-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
}

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(EXT_PATH, 'manifest.json'))) {
    throw new Error(
      `Xverse extension not unpacked at ${EXT_PATH}. ` +
      `Run: bash e2e/regtest/playwright-bootstrap.sh xverse`,
    );
  }
  if (!fs.existsSync(path.join(SEED_USER_DATA_DIR, 'Default'))) {
    throw new Error(
      `Xverse seed user-data-dir missing at ${SEED_USER_DATA_DIR}. ` +
      `globalSetup should have created it.`,
    );
  }

  // Sanity-check bitcoind is reachable + at least 101 blocks mined.
  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) {
    throw new Error(
      `regtest tip is ${tip} (<101). ` +
      `Run: bash e2e/regtest/regtest-bootstrap.sh`,
    );
  }

  // Clone the seed user-data-dir per test so we get a fresh Chromium
  // context but skip the 25s onboarding click flow. Strip Chromium's
  // singleton locks from the clone.
  const workingDir = `${SEED_USER_DATA_DIR}.cubes-xverse-${process.pid}-${Date.now()}`;
  fs.cpSync(SEED_USER_DATA_DIR, workingDir, { recursive: true });
  for (const stale of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    fs.rmSync(path.join(workingDir, stale), { force: true });
  }

  context = await chromium.launchPersistentContext(workingDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 30_000 });
  extensionId = worker.url().split('/')[2];
});

test.afterAll(async () => {
  await context?.close();
});

test('mint a cube via xverse: fill form → sign in wallet → broadcast → ord indexes the HTML byte-for-byte', async () => {
  test.setTimeout(360_000);

  // ─── Step 1: unlock Xverse from the primer popup ───────────────
  const primer = await context.newPage();
  await primer.setViewportSize({ width: 400, height: 800 });
  await primer.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await primer.waitForFunction(() => {
    const t = (document.body.innerText || '').toLowerCase();
    return t.includes('unlock') || t.includes('account 1');
  }, undefined, { timeout: 30_000, polling: 250 });
  if (/unlock/i.test(await primer.locator('body').innerText())) {
    await primer.locator('input[type="password"]').first().fill(TEST_PASSWORD);
    await primer.getByRole('button', { name: /^unlock$/i }).first().click();
    await primer.waitForFunction(() => {
      const t = (document.body.innerText || '').toLowerCase();
      return t.includes('account 1') || t.includes('not now') || t.includes('zest');
    }, undefined, { timeout: 30_000, polling: 250 });
  }
  const notNow = primer.getByText('Not now', { exact: true }).first();
  if (await notNow.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await notNow.click({ force: true }).catch(() => undefined);
  }
  await shot(primer, '01-xverse-unlocked');

  // ─── Step 2: open cubes-frontend + connect wallet via UI ───────
  const cubes = await context.newPage();
  // Surface browser console errors + page errors so a silent connect
  // failure inside sats-connect doesn't just look like "popup never
  // opened".
  cubes.on('console', (msg) => {
    if (msg.type() === 'error') {
      // eslint-disable-next-line no-console
      console.log(`[cubes console.error] ${msg.text()}`);
    }
  });
  cubes.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.log(`[cubes pageerror] ${err.message}`);
  });
  await cubes.goto(CUBES_URL, { waitUntil: 'domcontentloaded' });
  await expect(cubes.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });

  // The Detected: list only renders after wallets$ has polled at
  // least once (500ms).
  await expect(cubes.locator('[data-testid="wallet-picker-detected"]')).toBeVisible({ timeout: 10_000 });
  const connectLink = cubes.locator('[data-testid="wallet-connect-xverse"]');
  await expect(connectLink).toBeVisible({ timeout: 10_000 });
  await shot(cubes, '02-cubes-loaded');

  // Click "Xverse" — SDK's WalletService.connectWallet fires
  // xverseConnector.connect, which spawns Xverse's approval popup.
  const knownPagesBeforeConnect = new Set(context.pages());
  const connectPromise = connectLink.click().catch((err) => {
    // eslint-disable-next-line no-console
    console.log(`[cube-mint] connect click threw: ${err.message}`);
  });

  // Accept the FIRST new chrome-extension page as Xverse's connect
  // popup. Xverse's #/btc-select-address-request path renders body
  // text asynchronously — earlier iterations of this predicate
  // rejected the popup when body was empty at first check.
  const connectPopup = await waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeConnect,
    timeoutMs: 60_000,
    isApproval: async (p) => {
      const url = p.url();
      if (!url.startsWith('chrome-extension://')) return false;
      // eslint-disable-next-line no-console
      console.log(`[cube-mint] chose popup at ${url}`);
      return true;
    },
  }).catch(async (err) => {
    // eslint-disable-next-line no-console
    console.log(`[cube-mint] waitForApprovalPopup timeout. Pages in context:`);
    for (const p of context.pages()) {
      // eslint-disable-next-line no-console
      console.log(`  - ${p.url()}`);
    }
    throw err;
  });
  await connectPopup.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => undefined);
  // Snapshot the popup RIGHT NOW — before any waits — so we always
  // have a picture of what's rendering, even if the button-hydration
  // wait below times out. Previous iteration timed out on
  // `document.querySelectorAll('button').length > 0` and never took
  // this screenshot; that's why the artifact bundle was empty.
  await shot(connectPopup, '03a-xverse-popup-initial');

  // Poll for ANY hydrated interactive element (button, role=button,
  // a-tag). Xverse's Vite SPA hydration under xvfb has been observed
  // taking up to ~2 minutes in CI on cold cache; 3 min ceiling stays
  // comfortably above the observed p99.
  await connectPopup.waitForFunction(() => {
    return document.querySelectorAll('button, [role="button"], a').length > 0;
  }, undefined, { timeout: 180_000, polling: 500 });
  await shot(connectPopup, '03b-xverse-popup-hydrated');

  // Log every interactive element so we can see what Xverse actually
  // renders on the #/btc-select-address-request page.
  const interactive = await connectPopup.evaluate(() => {
    const sel = 'button, [role="button"], a';
    return Array.from(document.querySelectorAll(sel)).map((el) => ({
      tag: el.tagName,
      role: el.getAttribute('role') ?? '',
      text: (el.textContent ?? '').trim().slice(0, 80),
      disabled: el.hasAttribute('disabled'),
    }));
  });
  // eslint-disable-next-line no-console
  console.log(`[cube-mint] popup interactive elements: ${JSON.stringify(interactive)}`);

  // Xverse's CTA label varies across versions. Match any of the
  // common approve wordings across button + [role=button] + a-tag.
  await connectPopup.waitForFunction(() => {
    const sel = 'button, [role="button"], a';
    return Array.from(document.querySelectorAll(sel)).some((el) => {
      const label = (el.textContent ?? '').trim().toLowerCase();
      if (!/(connect|approve|confirm|allow|share|continue|next|proceed)/i.test(label)) return false;
      if (el.hasAttribute('disabled')) return false;
      const style = getComputedStyle(el);
      return style.pointerEvents !== 'none' && style.visibility !== 'hidden';
    });
  }, undefined, { timeout: 60_000, polling: 500 });
  // Click via the exact "Connect" text (matches the diagnostic log
  // from the previous CI run: buttons rendered were
  // ["Account 1Select", "Cancel", "Connect"]). force: true skips
  // Playwright's actionability check, but even that has intermittent
  // failures under xvfb — fall back to a programmatic click via
  // page.evaluate if the regular click times out.
  const connectBtn = connectPopup.getByRole('button', { name: /^Connect$/i });
  try {
    await connectBtn.first().click({ timeout: 15_000, force: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(`[cube-mint] connectBtn.click failed: ${(err as Error).message}; falling back to evaluate`);
    await connectPopup.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find((b) => (b.textContent ?? '').trim().toLowerCase() === 'connect');
      if (!btn) throw new Error('no Connect button in popup DOM');
      (btn as HTMLElement).click();
    });
  }
  await connectPromise;

  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 30_000 });
  await cubes.bringToFront();

  // Read paymentAddress from the DOM (start.component now renders it
  // via data-testid="mint-payment-address"). Same pattern cat21.space
  // uses — no localStorage divination.
  const paymentAddrLocator = cubes.locator('[data-testid="mint-payment-address"]');
  await expect(paymentAddrLocator).toBeVisible({ timeout: 15_000 });
  const paymentAddr = (await paymentAddrLocator.textContent())?.trim() ?? '';
  expect(paymentAddr).toMatch(/^bcrt1q|^bcrt1p|^m[a-zA-Z0-9]/);
  console.log(`[cube-mint] payment address: ${paymentAddr}`);

  // ─── Step 3: fund the payment address on regtest ───────────────
  rpc('-rpcwallet=cubes-e2e', 'sendtoaddress', paymentAddr, String(FUND_AMOUNT_BTC));
  await waitForElectrsSync(mineBlocks(1));
  await waitForUtxoAt(paymentAddr, Math.round(FUND_AMOUNT_BTC * 1e8));

  // ─── Step 4: fill the form ─────────────────────────────────────
  for (let i = 0; i < 6; i++) {
    await cubes.locator(`[data-testid="cube-side-${i + 1}"]`).fill(CUBE_SIDE_IDS[i]);
  }
  await cubes.locator('[data-testid="cube-fee-rate"]').fill('5');
  await shot(cubes, '04-form-filled');

  // ─── Step 4b: reload page to re-fire the UTXO fetch ───────────
  // Orchestrator's utxos$ chain runs once per wallet-connect. Funding
  // the wallet AFTER connect doesn't retrigger it; a reload does.
  // Same pattern cat21.space's mint spec follows.
  const knownPagesBeforeReload = new Set(context.pages());
  await cubes.reload({ waitUntil: 'domcontentloaded' });
  const reapprove = await waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeReload,
    timeoutMs: 15_000,
    isApproval: async (p) => p.url().startsWith('chrome-extension://'),
  }).catch(() => null);
  if (reapprove) {
    await reapprove.waitForLoadState('domcontentloaded');
    await reapprove.waitForFunction(() => document.querySelectorAll('button').length > 0, undefined, { timeout: 30_000, polling: 500 });
    const rBtn = reapprove.getByRole('button', { name: /^Connect$/i });
    await rBtn.first().click({ force: true, timeout: 15_000 }).catch(() => undefined);
  }

  // Refill the form after reload — reactive form values don't persist.
  await expect(cubes.locator('[data-testid="cube-side-1"]')).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 6; i++) {
    await cubes.locator(`[data-testid="cube-side-${i + 1}"]`).fill(CUBE_SIDE_IDS[i]);
  }
  await cubes.locator('[data-testid="cube-fee-rate"]').fill('5');
  await shot(cubes, '04b-form-refilled-after-reload');

  // ─── Step 5: compute the cube HTML the orchestrator will inscribe.
  // getCubeHtml is a pure function (services/cube-html.ts) — the
  // preview iframe renders exactly what this returns, and
  // start.component.ts encodes the same string as the inscription
  // body. No dependency on iframe/DOM binding timing.
  const expectedCubeHtml = getCubeHtml({
    inscriptionIds: {
      inscriptionId1: CUBE_SIDE_IDS[0],
      inscriptionId2: CUBE_SIDE_IDS[1],
      inscriptionId3: CUBE_SIDE_IDS[2],
      inscriptionId4: CUBE_SIDE_IDS[3],
      inscriptionId5: CUBE_SIDE_IDS[4],
      inscriptionId6: CUBE_SIDE_IDS[5],
    },
    title: '',
    rotationSpeedX: '',
    rotationSpeedY: '',
    colorPane: '',
    bgColor1: '',
    bgColor2: '',
  });
  expect(expectedCubeHtml).toContain('cubes.haushoppe.art');

  // ─── Step 5b: wallet must reconnect after reload before any
  //   simulation runs. WalletService reads LAST_CONNECTED_WALLET and
  //   auto-reconnects on boot; if the auto-reconnect stalls (extension
  //   race, permission popup not clicked, etc.), simulations$ never
  //   fires and mint-found-funds stays hidden until we time out.
  //   Failing here surfaces the root cause instead of hiding behind
  //   the mint-found-funds timeout.
  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 45_000 });

  // ─── Step 5c: verify Xverse returned the SAME payment address
  //   post-reload. Prior diagnostic (state=ready, connected=true,
  //   noUtxos=true) proved the wallet reconnected but orchestrator
  //   queried a wallet with no UTXOs — which happens iff Xverse handed
  //   back a different bech32 address than the one we funded. If they
  //   differ, fund the new one too and reload once more so the
  //   orchestrator's utxos$ re-fires against the funded address.
  const paymentAddrAfterReload = (await paymentAddrLocator.textContent())?.trim() ?? '';
  console.log(`[cube-mint] payment address after reload: ${paymentAddrAfterReload}`);
  if (paymentAddrAfterReload !== paymentAddr) {
    console.log(`[cube-mint] address changed across reload: ${paymentAddr} -> ${paymentAddrAfterReload}, refunding`);
    rpc('-rpcwallet=cubes-e2e', 'sendtoaddress', paymentAddrAfterReload, String(FUND_AMOUNT_BTC));
    await waitForElectrsSync(mineBlocks(1));
    await waitForUtxoAt(paymentAddrAfterReload, Math.round(FUND_AMOUNT_BTC * 1e8));
    const knownPagesBefore2nd = new Set(context.pages());
    await cubes.reload({ waitUntil: 'domcontentloaded' });
    const reapprove2 = await waitForApprovalPopup({
      context,
      knownPages: knownPagesBefore2nd,
      timeoutMs: 15_000,
      isApproval: async (p) => p.url().startsWith('chrome-extension://'),
    }).catch(() => null);
    if (reapprove2) {
      await reapprove2.waitForLoadState('domcontentloaded');
      await reapprove2.waitForFunction(() => document.querySelectorAll('button').length > 0, undefined, { timeout: 30_000, polling: 500 });
      await reapprove2.getByRole('button', { name: /^Connect$/i }).first().click({ force: true, timeout: 15_000 }).catch(() => undefined);
    }
    await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 45_000 });
    await expect(cubes.locator('[data-testid="cube-side-1"]')).toBeVisible({ timeout: 30_000 });
    for (let i = 0; i < 6; i++) {
      await cubes.locator(`[data-testid="cube-side-${i + 1}"]`).fill(CUBE_SIDE_IDS[i]);
    }
    await cubes.locator('[data-testid="cube-fee-rate"]').fill('5');
  }

  // ─── Step 5d: probe the ELECTRS query surface both ways so the
  //   next failure tells us which side lies. `waitForUtxoAt` above
  //   proved electrs (direct) sees the funded UTXO before the reload.
  //   Post-reload the orchestrator reports noUtxos=true. That can
  //   only happen if the SAME URL through the browser's fetch (via
  //   the dev-server proxy → electrs) returns []. Prove or disprove
  //   before waiting on the banner.
  const currentAddr = (await paymentAddrLocator.textContent())?.trim() ?? '';
  const proxyProbe = await cubes.evaluate(async (addr) => {
    try {
      const res = await fetch(`/api/address/${addr}/utxo`, { cache: 'no-store' });
      const bodyText = await res.text();
      return { ok: res.ok, status: res.status, contentType: res.headers.get('content-type'), body: bodyText.slice(0, 500) };
    } catch (err) {
      return { ok: false, status: -1, contentType: null, body: String(err) };
    }
  }, currentAddr);
  console.log(`[cube-mint] proxy-probe /api/address/${currentAddr}/utxo -> status=${proxyProbe.status} ctype=${proxyProbe.contentType} body=${proxyProbe.body}`);

  // ─── Step 6: wait for orchestrator to move to 'ready' + surface
  //   the mint-found-funds banner, then click Mint.
  const foundFunds = cubes.locator('[data-testid="mint-found-funds"]');
  try {
    await expect(foundFunds).toBeVisible({ timeout: 90_000 });
  } catch (e) {
    // Dump orchestrator state so we know WHICH step of the chain
    // stalled: no-wallet → wallet$ still empty; loading-utxos → utxos$
    // hasn't resolved; ready + viable.length===0 → funds not yet
    // credited on electrs; ready + selected null → auto-pick didn't
    // fire (content missing).
    const state = (await cubes.locator('[data-testid="mint-state"]').textContent().catch(() => '?'))?.trim();
    const noUtxos = await cubes.locator('[data-testid="mint-no-utxos"]').isVisible().catch(() => false);
    const loading = await cubes.locator('[data-testid="mint-loading-utxos"]').isVisible().catch(() => false);
    const insufficient = await cubes.locator('[data-testid="mint-insufficient-funds"]').isVisible().catch(() => false);
    const connected = await cubes.locator('[data-testid="wallet-connected"]').isVisible().catch(() => false);
    const contentSet = (await cubes.locator('[data-testid="mint-content-set"]').textContent().catch(() => '?'))?.trim();
    const simCount = (await cubes.locator('[data-testid="mint-sim-count"]').textContent().catch(() => '?'))?.trim();
    const feeFc = (await cubes.locator('[data-testid="mint-fee-fc-value"]').textContent().catch(() => '?'))?.trim();
    const ordAddr = (await cubes.locator('[data-testid="mint-ordinals-address"]').textContent().catch(() => '?'))?.trim();
    const lsWallet = await cubes.evaluate(() => localStorage.getItem('LAST_CONNECTED_WALLET')).catch(() => null);
    const sim0Insuff = (await cubes.locator('[data-testid="mint-sim-0-insufficient"]').textContent().catch(() => '?'))?.trim();
    const sim0Simulation = (await cubes.locator('[data-testid="mint-sim-0-simulation"]').textContent().catch(() => '?'))?.trim();
    const paymentOutputs = (await cubes.locator('[data-testid="mint-payment-outputs"]').textContent().catch(() => '?'))?.trim();
    console.error(`[cube-mint] ordinalsAddress DOM=${ordAddr}`);
    console.error(`[cube-mint] localStorage LAST_CONNECTED_WALLET=${lsWallet}`);
    console.error(`[cube-mint] sim[0].insufficient=${sim0Insuff} sim[0].simulation=${sim0Simulation} paymentOutputs.length=${paymentOutputs}`);
    const form1 = await cubes.locator('[data-testid="cube-side-1"]').inputValue().catch(() => '');
    const formFee = await cubes.locator('[data-testid="cube-fee-rate"]').inputValue().catch(() => '');
    console.error(
      `[cube-mint] mint-found-funds timeout — state="${state}" connected=${connected} noUtxos=${noUtxos} loading=${loading} insufficient=${insufficient} contentSet=${contentSet} sims=${simCount} feeFC="${feeFc}" form1="${form1}" fee="${formFee}"`,
    );
    throw e;
  }
  await shot(cubes, '05-found-funds');

  const mintBtn = cubes.locator('[data-testid="mint-btn"]');
  await expect(mintBtn).toBeEnabled({ timeout: 30_000 });

  const knownPagesBeforeMint = new Set(context.pages());
  await mintBtn.click();

  const signPopup = await waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeMint,
    timeoutMs: 120_000,
    isApproval: async (p) => {
      if (!p.url().startsWith('chrome-extension://')) return false;
      const t = (await p.locator('body').innerText().catch(() => '')).toLowerCase();
      return t.includes('review transaction') || t.includes('confirm');
    },
  });
  await shot(signPopup, '05-xverse-sign-approval');
  await signPopup.getByRole('button', { name: /^confirm$/i }).first().click();

  await expect(cubes.locator('[data-testid="mint-success"]')).toBeVisible({ timeout: 120_000 });
  await shot(cubes, '06-cubes-success');

  const commitTxId = (await cubes.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
  const revealTxId = (await cubes.locator('[data-testid="mint-reveal-txid"]').textContent())?.trim() ?? '';
  expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);
  expect(revealTxId).toMatch(/^[0-9a-f]{64}$/);
  console.log(`[cube-mint] commit=${commitTxId.slice(0, 12)}… reveal=${revealTxId.slice(0, 12)}…`);

  // ─── Step 7: mine both txs into blocks ─────────────────────────
  await waitForElectrsSync(mineBlocks(1));
  await waitForTxConfirmed(commitTxId);
  await waitForElectrsSync(mineBlocks(1));
  const revealTx = await waitForTxConfirmed(revealTxId);
  expect(revealTx.status.block_hash).toBeTruthy();

  // ─── Step 8: ord indexes the cube ─────────────────────────────
  await waitForOrdStockSync(Number(rpc('getblockcount').trim()));
  const inscriptionId = `${revealTxId}i0`;
  const { bytes: onChainBytes, contentType } = await getStockOrdContent(inscriptionId);
  expect(contentType).toBe('text/html;charset=utf-8');

  const onChainHtml = new TextDecoder().decode(onChainBytes);
  expect(onChainHtml).toBe(expectedCubeHtml);

  // Parser round-trip: parseCube must accept the on-chain bytes and
  // return the same six inscription IDs the form was filled with.
  // Parser round-trip: parseCube must accept the on-chain bytes and
  // extract the same six side IDs as the "Side N" traits. This is
  // the same parser cubes.haushoppe.art uses to render the gallery.
  const parsed = parseCube(onChainHtml);
  expect(parsed).toBeTruthy();
  const parsedSides = parsed!
    .filter((t) => /^Side \d$/.test(t.trait_type))
    .sort((a, b) => a.trait_type.localeCompare(b.trait_type))
    .map((t) => t.value);
  expect(parsedSides).toEqual(CUBE_SIDE_IDS);
});
