/* eslint-disable no-console */
import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { getCubeHtml } from '../../../src/app/services/cube-html';
import { parseCube } from '../../../src/shared/ordinals/parse-cube';
import {
  isExpectedConsoleError,
  waitForElectrsSync,
  fundCommonSats,
  expectTipPaid,
  openWalletPopover,
  readWalletPopoverAddress,
  waitForTxConfirmed,
  rpc,
  mineBlocks,
  waitForOrdStockSync,
  getStockOrdContent,
  isVisibleWithin,
  fillCubeSides,
  trackRequestFailures,
  openDetails,
  RENDERABLE_SIDE_IDS,
} from '../regtest-helpers';
import { closeLeftoverExtensionPages, onboardOkx } from 'ordpool-sdk/e2e';
import { recommendedFeesFixture } from 'ordpool-sdk';

/**
 * Full user-flow proof for OKX — cubes.haushoppe.art end-to-end on
 * regtest. Single-address wallet (BIP-86 P2TR default); same SDK
 * shim path as Unisat/Wizz (connector rewrite + wallet-side-address
 * signer shim); same cubes self-send gate skip.
 *
 * OKX-specific tricks (all from the SDK's proven okx-mint spec):
 *   - Onboarding uses the shared onboard-okx helper (already vendored
 *     into cubes-frontend/e2e/regtest/onboard-okx.ts).
 *   - Chromium arg `--disable-blink-features=AutomationControlled`
 *     required — OKX's popup detection sniffs for automation.
 *   - Context launched with `chromium.launchPersistentContext('')`
 *     (empty user-data-dir string) — OKX auto-opens its welcome
 *     page on extension install; the spec REUSES that page as
 *     onboardPage via `context.waitForEvent('page')`. Using a
 *     filesystem-path workingDir + fresh `context.newPage()`
 *     bypasses the auto-opened onboarding and lands on about:blank.
 *   - Connect popup anchored on "Connect account" HEADER text (not
 *     just any Connect button — OKX pre-emptively opens a "Confirm
 *     Trade" sign popup during connect that would false-match).
 *   - Sign popup: OKX reuses the connect popup's Page for sign, so
 *     waitForApprovalPopup's knownPages filter skips it. Poll every
 *     chrome-extension page for the sign-popup heading regardless of
 *     when the page was created. Match "Signature request",
 *     "Confirm Trade", or "Asset transfer pending" (OKX's copy has
 *     drifted across releases).
 *   - "Asset transfer pending" promo modal may cover Confirm —
 *     dismiss via close button first.
 *   - Playwright config's retries=2 applies (OKX historically flaky).
 */

const EXT_PATH = path.resolve(__dirname, '../extensions/okx');
const RESULTS_DIR = path.resolve(__dirname, '../../../test-results-regtest');
const CUBES_URL = 'http://localhost:4203/';
const FUND_AMOUNT_BTC = 0.002;

const CUBE_SIDE_IDS = RENDERABLE_SIDE_IDS;

let context: BrowserContext;
let extensionId: string;
let onboardPage: Page | null = null;

async function shot(p: Page, name: string): Promise<void> {
  await p.screenshot({
    path: path.resolve(RESULTS_DIR, `okx-cube-mint-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
}

/**
 * Polls the pages that EXIST rather than waiting for a new one.
 *
 * OKX reuses a single `notification.html` page, and it is frequently already
 * open when the connect click lands: opened during onboarding, or opened fast
 * enough to precede the snapshot of known pages. `waitForApprovalPopup` filters
 * known pages out and resolves only on a NEW page event, so in that case it
 * waits its full budget for a page that is already on screen and then reports
 * that no popup appeared. It is not intermittent: it depends entirely on
 * whether that page pre-exists, which is why it failed every local run and
 * passed in CI, where the profile is fresh.
 *
 * The sign path in this file already polls for this reason. This is the same
 * shape, applied to the connect step.
 */
async function approveOkxConnectPopup(ctx: BrowserContext): Promise<void> {
  const deadline = Date.now() + 60_000;
  let approval: Page | null = null;
  while (Date.now() < deadline) {
    for (const p of ctx.pages()) {
      if (!p.url().startsWith('chrome-extension://')) continue;
      const text = await p.locator('body').innerText().catch(() => '');
      if (/Connect account/i.test(text)) {
        approval = p;
        break;
      }
    }
    if (approval) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (approval === null) {
    throw new Error(
      'OKX connect popup never showed "Connect account" within 60s, on a new page or an existing one.',
    );
  }
  await shot(approval, '03a-connect-popup');
  await approval.getByRole('button', { name: /^connect$/i }).first().click();
  await approval.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
}

async function approveOkxSignPopup(ctx: BrowserContext): Promise<void> {
  const deadline = Date.now() + 120_000;
  let approval: Page | null = null;
  const seen = new Set<string>();
  while (Date.now() < deadline) {
    for (const p of ctx.pages()) {
      if (!p.url().startsWith('chrome-extension://')) continue;
      const text = await p.locator('body').innerText().catch(() => '');
      if (/Signature request|Confirm Trade|Asset transfer pending/i.test(text)) {
        approval = p;
        break;
      }
      const snippet = (text.split('\n').find((s) => s.trim().length > 0) ?? '').slice(0, 80);
      const key = `${p.url()}|${snippet}`;
      if (!seen.has(key)) {
        seen.add(key);
        console.log(`[okx-mint:diag] page url=${p.url().slice(0, 100)} first-line="${snippet}"`);
      }
    }
    if (approval) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!approval) throw new Error('OKX sign popup never showed Signature request | Confirm Trade within 120s');
  await shot(approval, '05a-sign-popup');

  // Promo modal may cover Confirm.
  const promo = approval.getByText('Asset transfer pending');
  if (await isVisibleWithin(promo, 2_000)) {
    const closeBtn = approval.locator('button:has(svg), [aria-label="close" i], [aria-label="Close" i]').first();
    if (await isVisibleWithin(closeBtn, 2_000)) {
      await closeBtn.click({ force: true }).catch(() => undefined);
    }
    await promo.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  }

  await shot(approval, '05b-post-promo-dismiss');
  await approval.getByText('Confirm', { exact: true }).first().click();
}

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(EXT_PATH, 'manifest.json'))) {
    throw new Error(
      `OKX extension not unpacked at ${EXT_PATH}. ` +
      `Run: bash e2e/regtest/playwright-bootstrap.sh okx`,
    );
  }

  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) {
    throw new Error(
      `regtest tip is ${tip} (<101). ` +
      `Run: bash e2e/regtest/regtest-bootstrap.sh`,
    );
  }

  // SDK spec parity: empty user-data-dir string (Chromium auto-creates
  // a fresh in-memory profile), and REUSE OKX's auto-opened welcome
  // page instead of creating a fresh newPage(). OKX opens its
  // onboarding tab on extension install; my earlier version's
  // `context.newPage()` landed on about:blank and the onboarding
  // never surfaced.
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 30_000 });
  extensionId = worker.url().split('/')[2];

  try {
    onboardPage = await context.waitForEvent('page', {
      predicate: (p) => p.url().startsWith(`chrome-extension://${extensionId}`),
      timeout: 15_000,
    });
  } catch {
    /* fall through to newPage below */
  }
  test.setTimeout(240_000);
  if (!onboardPage) onboardPage = await context.newPage();
  await onboardOkx(onboardPage, extensionId);
  await shot(onboardPage, '00-onboarded');
  // Do NOT close onboardPage — the OKX suite reuses it for the
  // wallet-approval popup Page reference (SDK spec pattern).
});

test.afterAll(async () => {
  await context?.close();
});

test('mint a cube via OKX: fill form → sign in wallet → broadcast → ord indexes the HTML byte-for-byte', async () => {
  test.setTimeout(360_000);

  const cubes = await context.newPage();
  const browserErrors: string[] = [];
  // Console noise is judged by the failing resource, not by status class:
  // see `isExpectedConsoleError` in regtest-helpers.
  cubes.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    console.log(`[okx-mint console.error] ${text}`);
    if (!isExpectedConsoleError(text, msg.location()?.url ?? '')) {
      browserErrors.push(`console.error: ${text}`);
    }
  });
  const requestFailures = trackRequestFailures(cubes);
  cubes.on('pageerror', (err) => {
    console.log(`[okx-mint pageerror] ${err.message}`);
    browserErrors.push(`pageerror: ${err.message}`);
  });

  await cubes.route('**/api/v1/fees/recommended', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      // Canonical shape captured from api.ordpool.space, so a contract change
        // reds here instead of passing against a body we invented. The spread is
        // passed explicitly because the captured sample came from a quiet mempool
        // where every tier reads 1-2 sat/vB and cannot separate fastest from hour.
        body: JSON.stringify(recommendedFeesFixture({ fastestFee: 5, halfHourFee: 3, hourFee: 1 })),
    });
  });

  await cubes.goto(CUBES_URL, { waitUntil: 'domcontentloaded' });
  await expect(cubes.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });

  await openDetails(cubes, 'configurator-advanced');
  await fillCubeSides(cubes, CUBE_SIDE_IDS);
  await shot(cubes, '02a-form-filled');

  // Pre-connect: this click opens the WALLET PICKER, not the checkout drawer,

  // so it must not wait for a drawer that cannot appear yet.

  await expect(cubes.locator('[data-testid="mint-cta"]')).toBeEnabled({ timeout: 30_000 });

  await cubes.locator('[data-testid="mint-cta"]').click();


  await expect(cubes.locator('[data-testid="wallet-picker-detected"]')).toBeVisible({ timeout: 10_000 });
  const connectLink = cubes.locator('[data-testid="wallet-connect-okx"]');
  await expect(connectLink).toBeVisible({ timeout: 10_000 });
  await shot(cubes, '02b-wallet-picker-open');


  await connectLink.click();
  await approveOkxConnectPopup(context);
  await cubes.bringToFront();

  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 45_000 });

  const paymentAddr = await readWalletPopoverAddress(cubes, 'wallet-popover-payment-address');
  // OKX's default is BIP-86 Taproot (bcrt1p on regtest).
  expect(paymentAddr).toMatch(/^bcrt1[qp]|^2/);
  console.log(`[okx-mint] payment address: ${paymentAddr}`);
  await cubes.locator('[data-testid="wallet-connected-btn"]').click();

  await fundCommonSats(paymentAddr, FUND_AMOUNT_BTC);

  await cubes.reload({ waitUntil: 'domcontentloaded' });


  try {
    await approveOkxConnectPopup(context);
  } catch {
    // No reconnect popup — OKX cached the auth.
  }
  await cubes.bringToFront();
  await expect(cubes.locator('[data-testid="wallet-connected-btn"]')).toBeVisible({ timeout: 45_000 });

  await openDetails(cubes, 'configurator-advanced');
  await fillCubeSides(cubes, CUBE_SIDE_IDS);
  await expect(cubes.locator('[data-testid="mint-cta"]')).toBeEnabled({ timeout: 60_000 });
  await cubes.locator('[data-testid="mint-cta"]').click();
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
  await mintBtn.click();

  const errLocator = cubes.locator('[data-testid="mint-error-message"]');
  await errLocator.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  if (await errLocator.isVisible()) {
    const postMintErr = (await errLocator.textContent())?.trim() ?? '';
    if (postMintErr && !postMintErr.includes('cancel')) {
      throw new Error(`orchestrator.mint() reported an error before the sign popup opened: ${postMintErr}`);
    }
  }

  await approveOkxSignPopup(context);
  console.log('[okx-mint] sign approved; waiting for mint-success');

  await expect(cubes.locator('[data-testid="mint-success"]')).toBeVisible({ timeout: 120_000 });
  await expect(cubes.locator('[data-testid="mint-btn"]')).toHaveAttribute('aria-busy', 'false');
  await shot(cubes, '06-success');

  const commitTxId = (await cubes.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
  const revealTxId = (await cubes.locator('[data-testid="mint-reveal-txid"]').getAttribute('aria-label'))?.trim() ?? '';
  expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);
  expect(revealTxId).toMatch(/^[0-9a-f]{64}$/);
  console.log(`[okx-mint] commit=${commitTxId.slice(0, 12)}… reveal=${revealTxId.slice(0, 12)}…`);

  await waitForElectrsSync(mineBlocks(1));
  const commitTx = await waitForTxConfirmed(commitTxId);
  await waitForElectrsSync(mineBlocks(1));
  const revealTx = await waitForTxConfirmed(revealTxId);
  expectTipPaid(commitTx, revealTx);
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
      [`Test passed the mint arc but ${browserErrors.length} unfiltered browser error(s) surfaced:`,
       ...browserErrors.map((e) => `  - ${e}`), ...requestFailures()].join('\n'),
    );
  }
});
