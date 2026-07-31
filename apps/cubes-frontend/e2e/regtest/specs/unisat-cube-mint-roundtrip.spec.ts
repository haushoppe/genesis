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
import { closeLeftoverExtensionPages, waitForApprovalPopup } from '../approval-popup';

/**
 * Full user-flow proof for Unisat — cubes.haushoppe.art end-to-end on
 * regtest. Same SDK regtest shim as Leather (ordpool-sdk 586bde5)
 * takes care of the mainnet→bcrt address rewrite; the interesting
 * deltas vs Leather's spec are all Unisat-specific:
 *
 *   - Onboarding uses stable Unisat testids: welcome-title →
 *     import-wallet-button → create-password-input/confirm →
 *     restore-wallet-type-option-0 → 12x mnemonic-import-word-N →
 *     mnemonic-import-continue-button, optionally followed by
 *     address-type-continue-button + notice-checkbox-1/notice-ok-button.
 *   - Approval-popup detection is URL-anchored: Unisat renders every
 *     dapp approval at `notification.html#/approval` on its extension
 *     origin. Cheaper + less flaky than element-anchored waits.
 *   - Connect click uses a styled `<div>` matched by text (Unisat
 *     doesn't render Connect as a <button>).
 *   - Sign click uses the stable `sign-psbt-button` testid.
 *   - Signer-side: Unisat's signPsbt takes NO network arg (the wallet
 *     always signs with its UI-selected network — default mainnet).
 *     Combined with the connector's address shim, the round-trip works
 *     without a signer-network override.
 *
 * If mint-success + on-chain byte-for-byte HTML check both pass, we've
 * proved: SDK connector rewrote mainnet→bcrt → user filled the form →
 * Unisat signed → chain accepted → ord indexed → bytes on-chain match
 * the preview iframe's HTML.
 */

const EXT_PATH = path.resolve(__dirname, '../extensions/unisat');
const RESULTS_DIR = path.resolve(__dirname, '../../../test-results-regtest');
const CUBES_URL = 'http://localhost:4203/';
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_MNEMONIC_WORDS = TEST_MNEMONIC.split(' ');
const TEST_PASSWORD = 'correct-horse-battery-staple-Tr0ub4dor-9876';

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
    path: path.resolve(RESULTS_DIR, `unisat-cube-mint-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
}

/**
 * Onboard Unisat from a mnemonic. Testids match the SDK's
 * `unisat-mint-roundtrip.spec.ts` reference — Unisat ships them on
 * every onboarding element, so no text-anchored waits needed.
 */
async function onboardUnisat(page: Page): Promise<void> {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto(`chrome-extension://${extensionId}/index.html`, { waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('welcome-title')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('import-wallet-button').click();

  await expect(page.getByTestId('create-password-input')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('create-password-input').fill(TEST_PASSWORD);
  await page.getByTestId('create-password-confirm-input').fill(TEST_PASSWORD);
  await page.getByTestId('create-password-continue-button').click();

  await expect(page.getByTestId('restore-wallet-type-option-0')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('restore-wallet-type-option-0').click();

  await expect(page.getByTestId('mnemonic-import-word-0')).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < TEST_MNEMONIC_WORDS.length; i++) {
    await page.getByTestId(`mnemonic-import-word-${i}`).fill(TEST_MNEMONIC_WORDS[i]);
  }
  await page.getByTestId('mnemonic-import-continue-button').click();

  const addressTypeContinue = page.getByTestId('address-type-continue-button');
  if (await addressTypeContinue.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await addressTypeContinue.click();
  }

  const noticeCheckbox = page.getByTestId('notice-checkbox-1');
  if (await noticeCheckbox.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await noticeCheckbox.click();
    const noticeOk = page.getByTestId('notice-ok-button');
    if (await noticeOk.isEnabled({ timeout: 3_000 }).catch(() => false)) {
      await noticeOk.click();
    }
  }

  await expect(page.getByTestId('tab-home')).toBeVisible({ timeout: 30_000 });
}

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(EXT_PATH, 'manifest.json'))) {
    throw new Error(
      `Unisat extension not unpacked at ${EXT_PATH}. ` +
      `Run: bash e2e/regtest/playwright-bootstrap.sh unisat`,
    );
  }

  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) {
    throw new Error(
      `regtest tip is ${tip} (<101). ` +
      `Run: bash e2e/regtest/regtest-bootstrap.sh`,
    );
  }

  const workingDir = path.resolve(RESULTS_DIR, `unisat-user-data-dir-${process.pid}-${Date.now()}`);
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

  const primer = await context.newPage();
  await onboardUnisat(primer);
  await shot(primer, '00-onboarded');
  await primer.close();
});

test.afterAll(async () => {
  await context?.close();
});

test('mint a cube via Unisat: fill form → sign in wallet → broadcast → ord indexes the HTML byte-for-byte', async () => {
  test.setTimeout(360_000);

  const cubes = await context.newPage();
  const browserErrors: string[] = [];
  const IGNORED_CONSOLE: RegExp[] = [
    /Failed to load resource:.*404/,
    /Failed to load resource:.*net::/,
    /^\[sdk:/,
    /has been blocked by CORS policy/,
  ];
  cubes.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    console.log(`[unisat-mint console.error] ${text}`);
    if (!IGNORED_CONSOLE.some((re) => re.test(text))) {
      browserErrors.push(`console.error: ${text}`);
    }
  });
  cubes.on('pageerror', (err) => {
    console.log(`[unisat-mint pageerror] ${err.message}`);
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
  const connectLink = cubes.locator('[data-testid="wallet-connect-unisat"]');
  await expect(connectLink).toBeVisible({ timeout: 10_000 });
  await shot(cubes, '02b-wallet-picker-open');

  const knownPagesBeforeConnect = new Set(context.pages());
  await connectLink.click();

  // Unisat's approval popup is URL-anchored at
  // `notification.html#/approval`; cheaper than element-anchored.
  const connectPopup = await waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeConnect,
    timeoutMs: 60_000,
    isApproval: async (p) => {
      await p.waitForURL(/notification\.html#\/approval/, { timeout: 60_000 });
      return true;
    },
  });
  await shot(connectPopup, '03a-connect-popup');
  // Unisat renders Connect as a styled <div>, not a <button> — match by text.
  await connectPopup.getByText(/^Connect$/).first().click();
  await connectPopup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await cubes.bringToFront();

  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 45_000 });

  await cubes.locator('[data-testid="wallet-connected-btn"]').click();
  const paymentAddrLoc = cubes.locator('[data-testid="wallet-popover-payment-address"]');
  await expect(paymentAddrLoc).toBeVisible({ timeout: 15_000 });
  const paymentAddr = ((await paymentAddrLoc.getAttribute('title')) ?? (await paymentAddrLoc.textContent()) ?? '').trim();
  // Unisat's default address type is BIP-84 P2WPKH (bc1q…); SDK shim
  // rewrites to bcrt1q. Users who selected other address types would
  // see bcrt-2… (Nested SegWit) or bcrt1p… (Taproot); address-type
  // matrix coverage is a follow-up.
  expect(paymentAddr).toMatch(/^bcrt1[qp]|^2/);
  console.log(`[unisat-mint] payment address: ${paymentAddr}`);
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

  // Sign popup: Unisat uses stable `sign-psbt-button` testid on the
  // approval page.
  const signPopup = await waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeSign,
    timeoutMs: 120_000,
    isApproval: async (p) => {
      if (!p.url().startsWith('chrome-extension://')) return false;
      await p.getByTestId('sign-psbt-button')
        .waitFor({ state: 'visible', timeout: 60_000 });
      return true;
    },
  });
  await shot(signPopup, '05a-sign-popup');
  await signPopup.getByTestId('sign-psbt-button').click();
  console.log('[unisat-mint] sign approved; waiting for mint-success');

  await expect(cubes.locator('[data-testid="mint-success"]')).toBeVisible({ timeout: 120_000 });
  await expect(cubes.locator('[data-testid="mint-btn"]')).toHaveAttribute('aria-busy', 'false');
  await shot(cubes, '06-success');

  const commitTxId = (await cubes.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
  const revealTxId = (await cubes.locator('[data-testid="mint-reveal-txid"]').getAttribute('aria-label'))?.trim() ?? '';
  expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);
  expect(revealTxId).toMatch(/^[0-9a-f]{64}$/);
  console.log(`[unisat-mint] commit=${commitTxId.slice(0, 12)}… reveal=${revealTxId.slice(0, 12)}…`);

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
