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
import { installAlbyAutoApprove, seedAlbyAccount } from 'ordpool-sdk/e2e';

/**
 * Full user-flow proof for Alby — cubes.haushoppe.art end-to-end on
 * regtest, through the REAL signing path: cubes' orchestrator calls the
 * SDK's albySigner, which calls alby.enable() + alby.webbtc.signPsbt()
 * in-page; Alby opens its real ConfirmSignPsbt popup and the state-based
 * auto-approver (installAlbyAutoApprove from ordpool-sdk/e2e) clicks it
 * the way a user would. Nothing about signing is bypassed or patched.
 *
 * (The one-time SW-message account SEED stays: Alby's real onboarding
 * needs an OAuth/NWC backend CI cannot provide. Seeding is test setup,
 * not a signing path.)
 *
 * Alby specifics:
 *   - Single-address wallet (BIP-86 Taproot only via `m/86'/1'/0'/0/0`
 *     with `bitcoinNetwork:'regtest'`). Payment + ordinals slots are
 *     the same address. Cubes' self-send gate skip (from f8d80e4)
 *     applies — cubes doesn't set `ownPaymentAddress`.
 *   - On regtest Alby shows an error toast (dummy lndhub balance fetch
 *     fails) that transiently occludes popup buttons, and hydrates its
 *     React handlers after first paint. The auto-approver waits both
 *     out by STATE (trial-click actionability + retry-until-closed).
 */

const EXT_PATH = path.resolve(__dirname, '../extensions/alby');
const RESULTS_DIR = path.resolve(__dirname, '../../../test-results-regtest');
const CUBES_URL = 'http://localhost:4203/';

/** Pinned per SDK spec — Alby v3.14.2's m/86'/1'/0'/0/0 for the
 *  abandon×11+about seed under `bitcoinNetwork:'regtest'`. Value
 *  verified live in the SDK's alby-mint spec iter 100+. */
const EXPECTED_REGTEST_TAPROOT = 'bcrt1p8wpt9v4frpf3tkn0srd97pksgsxc5hs52lafxwru9kgeephvs7rqjeprhg';

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
// Extension-origin page used ONLY for the account seed.
let seedPage: Page;

async function shot(p: Page, name: string): Promise<void> {
  await p.screenshot({
    path: path.resolve(RESULTS_DIR, `alby-cube-mint-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
}

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(EXT_PATH, 'manifest.json'))) {
    throw new Error(
      `Alby extension not unpacked at ${EXT_PATH}. ` +
      `Run: bash e2e/regtest/playwright-bootstrap.sh alby`,
    );
  }

  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) {
    throw new Error(
      `regtest tip is ${tip} (<101). ` +
      `Run: bash e2e/regtest/regtest-bootstrap.sh`,
    );
  }

  const workingDir = path.resolve(RESULTS_DIR, `alby-user-data-dir-${process.pid}-${Date.now()}`);
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
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 30_000 });
  extensionId = worker.url().split('/')[2];

  // seedPage: extension-origin page kept alive for SW-message fires.
  // Block window.close + beforeunload so Alby's React onboarding wizard
  // can't self-navigate away between seedAlbyAccount and later
  // sign calls (SDK iter 95 finding).
  seedPage = await context.newPage();
  await seedPage.addInitScript(() => {
    try {
      Object.defineProperty(window, 'close', { value: () => undefined, writable: false, configurable: false });
    } catch { /* ignore */ }
    try {
      const stop = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };
      window.addEventListener('beforeunload', stop as unknown as EventListener, true);
    } catch { /* ignore */ }
  });
  await seedPage.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
  // Let the SW finish its init state machine before we start firing messages.
  await seedPage.waitForFunction(() => true, undefined, { timeout: 2_000 }).catch(() => undefined);

  await seedAlbyAccount(seedPage);
  await shot(seedPage, '00-after-seed').catch(() => undefined);
  // Seeding done — signing goes through the in-page provider + real popup.
  await seedPage.close();
});

test.afterAll(async () => {
  await context?.close();
});

test('mint a cube via Alby: fill form → sign in the REAL Alby popup → broadcast → ord indexes the HTML byte-for-byte', async () => {
  test.setTimeout(360_000);

  const cubes = await context.newPage();

  // Auto-approve every Alby popup (enable permission + the REAL
  // ConfirmSignPsbt at mint time) with the shared state-based handler.
  installAlbyAutoApprove(context);

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
    console.log(`[alby-mint console.error] ${text}`);
    if (!IGNORED_CONSOLE.some((re) => re.test(text))) {
      browserErrors.push(`console.error: ${text}`);
    }
  });
  cubes.on('pageerror', (err) => {
    console.log(`[alby-mint pageerror] ${err.message}`);
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

  // Cubes' WalletService.wallets$ polls at 0/500/1000/1500ms after
  // Angular boots (ordpool-sdk wallet.service.ts:88). Alby's inpage
  // script can inject late in CI under CPU load, missing that
  // window. Wait explicitly for window.alby, then reload cubes so a
  // fresh wallets$ subscription catches Alby's already-injected inpage.
  await cubes.waitForFunction(
    () => Boolean((window as unknown as { alby?: unknown }).alby),
    undefined,
    { timeout: 60_000, polling: 250 },
  );
  console.log('[alby-mint] window.alby present; reloading cubes for fresh wallet detection');
  await cubes.reload({ waitUntil: 'domcontentloaded' });
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
  const connectLink = cubes.locator('[data-testid="wallet-connect-alby"]');
  await expect(connectLink).toBeVisible({ timeout: 10_000 });
  await shot(cubes, '02b-wallet-picker-open');
  await connectLink.click();
  // alby.enable() + webbtc.getAddress() may open a permission popup.
  // Auto-clicker (installed above) handles it.

  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 60_000 });

  await cubes.locator('[data-testid="wallet-connected-btn"]').click();
  const paymentAddrLoc = cubes.locator('[data-testid="wallet-popover-payment-address"]');
  await expect(paymentAddrLoc).toBeVisible({ timeout: 15_000 });
  const paymentAddr = ((await paymentAddrLoc.getAttribute('title')) ?? (await paymentAddrLoc.textContent()) ?? '').trim();
  // Alby is Taproot-only on regtest — bcrt1p prefix, and specifically
  // the pinned BIP-86 derivation of the test seed.
  expect(paymentAddr).toBe(EXPECTED_REGTEST_TAPROOT);
  console.log(`[alby-mint] payment address: ${paymentAddr}`);
  await cubes.locator('[data-testid="wallet-connected-btn"]').click();

  rpc('-rpcwallet=cubes-e2e', 'sendtoaddress', paymentAddr, String(FUND_AMOUNT_BTC));
  await waitForElectrsSync(mineBlocks(1));
  await waitForUtxoAt(paymentAddr, Math.round(FUND_AMOUNT_BTC * 1e8));

  await cubes.reload({ waitUntil: 'domcontentloaded' });

  await cubes.bringToFront();
  await expect(cubes.locator('[data-testid="wallet-connected-btn"]')).toBeVisible({ timeout: 60_000 });

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
  await mintBtn.click();
  // Sign step: cubes' orchestrator calls the SDK Alby signer →
  // alby.webbtc.signPsbt(hex) → Alby's REAL ConfirmSignPsbt popup →
  // auto-approved state-based → wire-tx hex returned → cubes broadcasts.

  const errLocator = cubes.locator('[data-testid="mint-error-message"]');
  await errLocator.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  if (await errLocator.isVisible()) {
    const postMintErr = (await errLocator.textContent())?.trim() ?? '';
    if (postMintErr && !postMintErr.includes('cancel')) {
      throw new Error(`orchestrator.mint() reported an error: ${postMintErr}`);
    }
  }

  await expect(cubes.locator('[data-testid="mint-success"]')).toBeVisible({ timeout: 120_000 });
  await expect(cubes.locator('[data-testid="mint-btn"]')).toHaveAttribute('aria-busy', 'false');
  await shot(cubes, '06-success');

  const commitTxId = (await cubes.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
  const revealTxId = (await cubes.locator('[data-testid="mint-reveal-txid"]').getAttribute('aria-label'))?.trim() ?? '';
  expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);
  expect(revealTxId).toMatch(/^[0-9a-f]{64}$/);
  console.log(`[alby-mint] commit=${commitTxId.slice(0, 12)}… reveal=${revealTxId.slice(0, 12)}…`);

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
