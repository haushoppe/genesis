/* eslint-disable no-console */
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
  waitForOrdStockSync,
  getStockOrdContent,
  openDetails,
} from '../regtest-helpers';
import { closeLeftoverExtensionPages, onboardWizz, waitForApprovalPopup } from 'ordpool-sdk/e2e';

/**
 * Full user-flow proof for Wizz — cubes.haushoppe.art end-to-end on
 * regtest. Wizz is a Unisat fork, so the SDK path is identical to
 * Unisat (connector-shim rewrites mainnet → bcrt on connect;
 * wallet-side-address shim translates back to mainnet for
 * toSignInputs on sign). Cubes self-send gate skip from f8d80e4
 * also applies — Wizz is single-address like Unisat.
 *
 * Wizz-specific deltas:
 *   - Onboarding is text-anchored (Wizz strips testids from its
 *     build). Sequence: "I already have a wallet" → 2 password
 *     inputs → "Wizz Wallet" source picker → 12 mnemonic inputs →
 *     "Native Segwit (P2WPKH)" address-type → 3 Ant-Design
 *     `label.ant-checkbox-wrapper` Security Tips → OK.
 *   - CI hostility: Wizz mounts a `configs.wizz.cash` remote-config
 *     fetch that hangs in CI. Route-abort the request.
 *   - Approval popup is URL-anchored at `notification.html#/approval`
 *     (Unisat-fork).
 *   - Sign button rendered with a spinner overlay + custom braille
 *     chars in textContent — click INSIDE page.evaluate to
 *     atomically match + click.
 */

const EXT_PATH = path.resolve(__dirname, '../extensions/wizz');
const RESULTS_DIR = path.resolve(__dirname, '../../../test-results-regtest');
const CUBES_URL = 'http://localhost:4203/';

const FUND_AMOUNT_BTC = 0.002;

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
    path: path.resolve(RESULTS_DIR, `wizz-cube-mint-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
}

async function approveWizzConnectPopup(ctx: BrowserContext, knownPages: Set<Page>): Promise<void> {
  const approval = await waitForApprovalPopup({
    context: ctx,
    knownPages,
    timeoutMs: 60_000,
    isApproval: async (p) => {
      await p.waitForURL(/notification\.html#\/approval/, { timeout: 60_000 });
      return true;
    },
  });
  await shot(approval, '03a-connect-popup');
  // Wizz inherits Unisat's connect-approval — Connect is a styled div.
  await approval.getByText(/^Connect$/).first().click();
  await approval.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
}

async function approveWizzSignPopup(ctx: BrowserContext, knownPages: Set<Page>): Promise<void> {
  const approval = await waitForApprovalPopup({
    context: ctx,
    knownPages,
    timeoutMs: 120_000,
    isApproval: async (p) => {
      await p.waitForURL(/notification\.html#\/approval/, { timeout: 120_000 });
      return true;
    },
  });
  await shot(approval, '05a-sign-popup');
  // TEMP instrumentation: surface the popup's own JS errors so we can see
  // exactly which field/line the balance-load throws on (instead of guessing
  // stub shapes against a minified bundle).
  approval.on('console', (m) => {
    if (m.type() === 'error') console.log(`[wizz-sign-popup console.error] ${m.text()}`);
  });
  approval.on('pageerror', (e) => {
    console.log(`[wizz-sign-popup pageerror] ${e.message}\n${(e.stack || '').slice(0, 600)}`);
  });
  await approval.waitForTimeout(4000); // let the balance-load fire + throw
  // Sign button carries a spinner overlay + custom braille chars in
  // textContent while Wizz analyses the PSBT — atomically match +
  // click inside page.evaluate to sidestep the pointer-events race.
  await approval.waitForFunction(() => {
    const isSignButton = (el: Element) => {
      // Strip any spinner glyphs (braille/bullets, one OR many) before
      // matching, so we find the button whatever its loading overlay
      // renders in textContent.
      const text = (el.textContent || '').replace(/[^\x20-\x7E]/g, '').trim();
      return /^Sign$/i.test(text);
    };
    const els = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], div'));
    const candidate = els.find(isSignButton);
    if (!candidate) return null;
    const style = getComputedStyle(candidate);
    if (style.pointerEvents === 'none') return null;
    if (parseFloat(style.opacity) < 0.7) return null;
    candidate.click();
    return { text: candidate.textContent };
  }, undefined, { timeout: 90_000, polling: 250 });
  console.log('[wizz-mint] clicked sign-button (popup may have closed)');
}

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(EXT_PATH, 'manifest.json'))) {
    throw new Error(
      `Wizz extension not unpacked at ${EXT_PATH}. ` +
      `Run: bash e2e/regtest/playwright-bootstrap.sh wizz`,
    );
  }

  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) {
    throw new Error(
      `regtest tip is ${tip} (<101). ` +
      `Run: bash e2e/regtest/regtest-bootstrap.sh`,
    );
  }

  const workingDir = path.resolve(RESULTS_DIR, `wizz-user-data-dir-${process.pid}-${Date.now()}`);
  fs.mkdirSync(workingDir, { recursive: true });

  context = await chromium.launchPersistentContext(workingDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  // Block Wizz's remote-config fetch that hangs in CI (no outbound
  // to configs.wizz.cash on GHA runners).
  await context.route('**/configs.wizz.cash/**', route => route.abort());

  // ── Make the sign popup hermetic ──────────────────────────────────
  // The sign popup will NOT enable its Sign button until it has loaded the
  // account balance AND analysed the PSBT for atomicals/runes. Wizz (a
  // Unisat fork) does that against a fleet of LIVE third-party backends —
  // its own ep.wizz.cash (Atomicals ElectrumX proxy) + ordx.wizz.cash
  // (runes indexer), plus wallet-api.unisat.io, api.rgbpp.io. If ANY of
  // them throws, the popup shows "Failed to load balance" and Sign stays
  // disabled forever. In CI they are flaky, and when Wizz's own backend is
  // down they 503 for everyone. Nothing here is real on regtest (no
  // atomicals, no runes, no rgbpp assets), so intercept EVERY one of these
  // hosts and return the truthful "empty" result — the test then depends
  // only on the local regtest stack, not on Wizz's server uptime.
  //
  // Shapes: the ep.wizz.cash envelope is {success, response} (verified
  // against WizzWallet/elex-proxy `R::ok`); the unisat + rgbpp envelopes
  // are copied verbatim from real 200 responses captured in the CI trace.
  const okJson = (body: unknown) => ({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  });
  // ep.wizz.cash — Atomicals ElectrumX proxy. listscripthash feeds the
  // balance panel (needs an object `global` + arrays it can iterate);
  // decode_psbt feeds the PSBT preview. Both: nothing found.
  await context.route('**/ep.wizz.cash/**', (route) => {
    const u = route.request().url();
    return route.fulfill(okJson(
      u.includes('listscripthash')
        // Reverse-engineered from the Wizz bundle (ui.js): it reads
        // `response.global.height.toLocaleString()` (so height MUST be a
        // number — an empty `global` threw and produced "Failed to load
        // balance"), the balance panel's gating `B.height` derives from it,
        // and the "Network not match" guard only fires when
        // `global.atomical_count` is truthy, so 0 skips it. Wizz's network
        // is "mainnet" (the regtest connector-shim keeps it mainnet-side).
        ? { success: true, response: { global: { height: 900000, network: 'mainnet', atomical_count: 0 }, atomicals: {}, utxos: [] } }
        : { success: true, response: {} },
    ));
  });
  // ordx.wizz.cash — Wizz runes indexer (runes/decode/psbt, runes/outputs,
  // …): no runes. Permissive envelope covering list/total/outputs access.
  await context.route('**/ordx.wizz.cash/**', route =>
    route.fulfill(okJson({ code: 0, msg: 'ok', data: { list: [], total: 0, outputs: [] } })));
  // api.rgbpp.io — RGB++ assets ([]) + balance ({address, xudt}). Empty.
  await context.route('**/api.rgbpp.io/**', (route) => {
    const u = route.request().url();
    return route.fulfill(u.includes('/assets')
      ? okJson([])
      : okJson({ address: '', xudt: [] }));
  });
  // wallet-api.unisat.io — the Unisat wallet API Wizz inherits. The balance
  // aggregates multi-assets + brc20 + inscriptions here; ALL of them flake
  // in CI (observed 503/-1 run-to-run), so intercept the whole host.
  const UNISAT_ZERO_ASSET = {
    totalSatoshis: 0, btcSatoshis: 0, assetSatoshis: 0, inscriptionCount: 0,
    atomicalsCount: 0, brc20Count: 0, brc20Count5Byte: 0, brc20Count6Byte: 0,
    arc20Count: 0, runesCount: 0,
  };
  await context.route('**/wallet-api.unisat.io/**', (route) => {
    const u = route.request().url();
    if (u.includes('/address/multi-assets')) {
      // one zero-asset object per queried address (the array length must match).
      const addrs = (new URL(u).searchParams.get('addresses') || '').split(',').filter(Boolean);
      return route.fulfill(okJson({ code: 0, msg: 'ok', data: addrs.map(() => UNISAT_ZERO_ASSET) }));
    }
    if (u.includes('/default/check-website')) {
      return route.fulfill(okJson({ code: 0, msg: 'ok', data: { isScammer: false, warning: '', allowQuickMultiSign: false } }));
    }
    // tx/decode2 (per-input PSBT decode) has an input-specific shape we can't
    // fabricate; leave it live (it answers reliably and isn't the balance gate).
    if (u.includes('/tx/decode')) return route.continue();
    // brc20 lists, inscriptions, everything else: empty list.
    return route.fulfill(okJson({ code: 0, msg: 'ok', data: { list: [], total: 0 } }));
  });
  // mempool.space — tx history (balance panel) + fiat price, both flaky here.
  await context.route('**/mempool.space/api/address/*/txs**', route => route.fulfill(okJson([])));
  await context.route('**/mempool.space/api/v1/historical-price**', route =>
    route.fulfill(okJson({ prices: [], exchangeRates: {} })));
  // Wizz marketplace aggregator — not needed for signing, 503s in CI.
  await context.route('**/mkt.wizz.cash/**', route => route.abort());

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 30_000 });
  extensionId = worker.url().split('/')[2];

  const primer = await context.newPage();
  await onboardWizz(primer, extensionId, { password: 'correct-horse-battery-staple-Tr0ub4dor-9876' });
  await shot(primer, '00-onboarded');
  await primer.close();
});

test.afterAll(async () => {
  await context?.close();
});

test('mint a cube via Wizz: fill form → sign in wallet → broadcast → ord indexes the HTML byte-for-byte', async () => {
  test.setTimeout(360_000);

  const cubes = await context.newPage();
  const browserErrors: string[] = [];
  const IGNORED_CONSOLE: RegExp[] = [
    /Failed to load resource:.*404/,
    /Failed to load resource:.*net::/,
    /^\[sdk:/,
    /\[inscribe-mint-orchestrator\] simulation threw for utxo/,
    /has been blocked by CORS policy/,
  ];
  cubes.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    console.log(`[wizz-mint console.error] ${text}`);
    if (!IGNORED_CONSOLE.some((re) => re.test(text))) {
      browserErrors.push(`console.error: ${text}`);
    }
  });
  cubes.on('pageerror', (err) => {
    console.log(`[wizz-mint pageerror] ${err.message}`);
    browserErrors.push(`pageerror: ${err.message}`);
  });

  await cubes.route('**/api/v1/fees/recommended', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      body: JSON.stringify({
        fastestFee: 5, halfHourFee: 3, hourFee: 1, economyFee: 1, minimumFee: 1,
      }),
    });
  });

  await cubes.goto(CUBES_URL, { waitUntil: 'domcontentloaded' });
  await expect(cubes.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });

  await openDetails(cubes, 'configurator-advanced');
  for (let i = 0; i < 6; i++) {
    await cubes.locator(`[data-testid="cube-side-${i + 1}"]`).fill(CUBE_SIDE_IDS[i]);
  }
  await shot(cubes, '02a-form-filled');

  const mintCta = cubes.locator('[data-testid="mint-cta"]');
  await expect(mintCta).toBeEnabled({ timeout: 10_000 });
  await mintCta.click();

  await expect(cubes.locator('[data-testid="wallet-picker-detected"]')).toBeVisible({ timeout: 10_000 });
  const connectLink = cubes.locator('[data-testid="wallet-connect-wizz"]');
  await expect(connectLink).toBeVisible({ timeout: 10_000 });
  await shot(cubes, '02b-wallet-picker-open');

  const knownPagesBeforeConnect = new Set(context.pages());
  await connectLink.click();
  await approveWizzConnectPopup(context, knownPagesBeforeConnect);
  await cubes.bringToFront();

  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 45_000 });

  await cubes.locator('[data-testid="wallet-connected-btn"]').click();
  const paymentAddrLoc = cubes.locator('[data-testid="wallet-popover-payment-address"]');
  await expect(paymentAddrLoc).toBeVisible({ timeout: 15_000 });
  const paymentAddr = ((await paymentAddrLoc.getAttribute('title')) ?? (await paymentAddrLoc.textContent()) ?? '').trim();
  expect(paymentAddr).toMatch(/^bcrt1q/);
  console.log(`[wizz-mint] payment address: ${paymentAddr}`);
  await cubes.locator('[data-testid="wallet-connected-btn"]').click();

  rpc('-rpcwallet=cubes-e2e', 'sendtoaddress', paymentAddr, String(FUND_AMOUNT_BTC));
  await waitForElectrsSync(mineBlocks(1));
  await waitForUtxoAt(paymentAddr, Math.round(FUND_AMOUNT_BTC * 1e8));

  await cubes.reload({ waitUntil: 'domcontentloaded' });

  const knownPagesBeforeReconnect = new Set(context.pages());
  const reapprovePromise = waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeReconnect,
    timeoutMs: 15_000,
    isApproval: async (p) => {
      await p.waitForURL(/notification\.html#\/approval/, { timeout: 15_000 });
      return true;
    },
  }).catch(() => null);
  const reapprove = await reapprovePromise;
  if (reapprove) {
    await reapprove.getByText(/^Connect$/).first().click();
    await reapprove.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  }
  await cubes.bringToFront();
  await expect(cubes.locator('[data-testid="wallet-connected-btn"]')).toBeVisible({ timeout: 45_000 });

  await openDetails(cubes, 'configurator-advanced');
  for (let i = 0; i < 6; i++) {
    await cubes.locator(`[data-testid="cube-side-${i + 1}"]`).fill(CUBE_SIDE_IDS[i]);
  }
  const mintCtaAfterReload = cubes.locator('[data-testid="mint-cta"]');
  await expect(mintCtaAfterReload).toBeEnabled({ timeout: 15_000 });
  await mintCtaAfterReload.click();
  await expect(cubes.locator('[data-testid="mint-checkout"]')).toBeVisible({ timeout: 10_000 });
  await openDetails(cubes, 'mint-advanced');
  await expect(cubes.locator('[data-testid="cube-fee-rate"]')).toBeVisible({ timeout: 30_000 });
  await cubes.locator('[data-testid="cube-fee-rate"]').fill('5');
  await shot(cubes, '04-drawer-open');

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

  const mintBtn = cubes.locator('[data-testid="mint-btn"]');
  await expect(mintBtn).toBeEnabled({ timeout: 60_000 });

  await closeLeftoverExtensionPages(context, [cubes]);
  const knownPagesBeforeSign = new Set(context.pages());
  await mintBtn.click();

  const errLocator = cubes.locator('[data-testid="mint-error-message"]');
  await errLocator.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  if (await errLocator.isVisible()) {
    const postMintErr = (await errLocator.textContent())?.trim() ?? '';
    if (postMintErr && !postMintErr.includes('cancel')) {
      throw new Error(`orchestrator.mint() reported an error before the sign popup opened: ${postMintErr}`);
    }
  }

  await approveWizzSignPopup(context, knownPagesBeforeSign);

  await expect(cubes.locator('[data-testid="mint-success"]')).toBeVisible({ timeout: 120_000 });
  await expect(cubes.locator('[data-testid="mint-btn"]')).toHaveAttribute('aria-busy', 'false');
  await shot(cubes, '06-success');

  const commitTxId = (await cubes.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
  const revealTxId = (await cubes.locator('[data-testid="mint-reveal-txid"]').getAttribute('aria-label'))?.trim() ?? '';
  expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);
  expect(revealTxId).toMatch(/^[0-9a-f]{64}$/);
  console.log(`[wizz-mint] commit=${commitTxId.slice(0, 12)}… reveal=${revealTxId.slice(0, 12)}…`);

  await waitForElectrsSync(mineBlocks(1));
  await waitForTxConfirmed(commitTxId);
  await waitForElectrsSync(mineBlocks(1));
  const revealTx = await waitForTxConfirmed(revealTxId);
  expect(revealTx.status.block_hash).toBeTruthy();

  await waitForOrdStockSync(Number(rpc('getblockcount').trim()));
  const inscriptionId = `${revealTxId}i0`;
  const { bytes: onChainBytes, contentType } = await getStockOrdContent(inscriptionId);
  expect(contentType).toBe('text/html;charset=utf-8');

  const onChainHtml = new TextDecoder().decode(onChainBytes);
  expect(onChainHtml).toBe(expectedCubeHtml);

  const parsed = parseCube(onChainHtml);
  expect(parsed).toBeTruthy();
  const parsedSides = parsed!
    .filter((t) => /^Side \d$/.test(t.trait_type))
    .sort((a, b) => a.trait_type.localeCompare(b.trait_type))
    .map((t) => t.value);
  expect(parsedSides).toEqual(CUBE_SIDE_IDS);

  if (browserErrors.length) {
    throw new Error(
      `Test passed the mint arc but ${browserErrors.length} unfiltered browser error(s) surfaced:\n  - ${browserErrors.join('\n  - ')}`,
    );
  }
});
