/* eslint-disable no-console */
import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { parseCube } from '../../../src/shared/ordinals/parse-cube';
import {
  getUtxos,
  waitForElectrsSync,
  fundCommonSats,
  expectTipPaid,
  openWalletPopover,
  waitForTxConfirmed,
  rpc,
  mineBlocks,
  waitForOrdStockSync,
  getStockOrdContent,
  fillCubeSides,
  openDetails,
  RENDERABLE_SIDE_IDS,
} from '../regtest-helpers';
import { closeLeftoverExtensionPages, onboardLeather, waitForApprovalPopup, seedDirtyCoin } from 'ordpool-sdk/e2e';
import { recommendedFeesFixture } from 'ordpool-sdk';

/**
 * Full user-flow proof for the Leather wallet — cubes.haushoppe.art
 * end-to-end on regtest. Structurally identical to the cat21-wallet
 * spec (cat21-wallet IS a Leather fork with the same onboard/popup
 * DOM). The one meaningful delta is the regtest-address path:
 *
 *   - Leather's SDK connector ignores its `network` arg and returns
 *     mainnet bc1q / bc1p addresses. The SDK's new
 *     `network-address-shim` (ordpool-sdk 8c52db7) intercepts on
 *     `Network.Regtest` and re-derives bcrt equivalents from the same
 *     pubkeys before the WalletInfo reaches the app. Consumers see
 *     bcrt addresses directly — this spec is the first real proof
 *     that the shim works end-to-end at the cubes-frontend level.
 *   - Signer-side, Leather's signPsbt takes a `network` arg. The SDK
 *     signer routes it through `toWireNetworkFor(leather, appNetwork)`
 *     so Regtest → 'mainnet' on the wire (script bytes are
 *     HRP-independent; the wallet's mainnet-derived key signs bytes
 *     that verify against the equivalent bcrt scriptPubKey).
 *
 * Same runtime tricks apply as cat21-wallet's spec:
 *   - `get-addresses-approve-button` testid (shared Leather DOM).
 *   - Wait for popup's own close after approve (both wallets sometimes
 *     need a brief post-approve delay before addresses dispatch).
 *   - Sign click uses `{ noWaitAfter: true }` — cheap insurance
 *     against a self-close race even if Leather doesn't strictly
 *     need it.
 *
 * If mint-success + on-chain byte-for-byte HTML check both pass,
 * we've proved: user clicked → Leather signed a regtest PSBT with
 * `network: 'mainnet'` → chain accepted → ord indexed → the bytes
 * on-chain are exactly the cube the preview iframe rendered.
 */

const EXT_PATH = path.resolve(__dirname, '../extensions/leather');
const RESULTS_DIR = path.resolve(__dirname, '../../../test-results-regtest');
const CUBES_URL = 'http://localhost:4203/';

/** Same 0.002 BTC budget as the other cubes specs — covers commit +
 *  reveal fees + postage + tip at 5 sat/vB. */
const FUND_AMOUNT_BTC = 0.002;

/** Six valid-format inscription IDs; the ord cube-parser doesn't
 *  dereference `/content/<id>` while walking, so unresolvable IDs
 *  are fine as long as they pass `isValidInscriptionId`. */
const CUBE_SIDE_IDS = RENDERABLE_SIDE_IDS;


/**
 * Documentation screenshots live OUTSIDE Playwright's outputDir, which is
 * cleared at the start of every run: a picture written there is gone the moment
 * anyone runs another spec, which is not what "the screenshot exists" should
 * mean. Gitignored; regenerate by running this lane.
 */
const STATE_SHOTS = path.resolve(__dirname, '../.state-screenshots');

let context: BrowserContext;
let extensionId: string;

async function shot(p: Page, name: string): Promise<void> {
  await p.screenshot({
    path: path.resolve(RESULTS_DIR, `leather-cube-mint-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
}

/**
 * Click the sign-approval button on a Leather popup. `noWaitAfter` is
 * cheap insurance against a self-close race — Leather closes its own
 * popup on sign completion; the default post-click stability wait would
 * race against the teardown. Same trick as cat21-wallet.
 */
async function clickLeatherApproval(popup: Page): Promise<void> {
  const btn = popup.getByRole('button', { name: /^(confirm|sign|approve)$/i }).first();
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.click({ noWaitAfter: true, timeout: 30_000 });
}

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(EXT_PATH, 'manifest.json'))) {
    throw new Error(
      `Leather extension not unpacked at ${EXT_PATH}. ` +
      `Run: bash e2e/regtest/playwright-bootstrap.sh leather`,
    );
  }

  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) {
    throw new Error(
      `regtest tip is ${tip} (<101). ` +
      `Run: bash e2e/regtest/regtest-bootstrap.sh`,
    );
  }

  const workingDir = path.resolve(RESULTS_DIR, `leather-user-data-dir-${process.pid}-${Date.now()}`);
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
  await onboardLeather(primer, extensionId);
  await shot(primer, '00-onboarded');
  await primer.close();
});

test.afterAll(async () => {
  await context?.close();
});


/**
 * The NOTICE case: a wallet that keeps payments on a different address from its
 * ordinals, whose only spendable coin carries an inscription.
 *
 * Leather hands out a bcrt1q payment address and a bcrt1p ordinals address, so
 * `isOneAddressWallet` is false. Spending the funding coin cannot touch what is
 * held at the ordinals address, and the coin's own contents are named, so the
 * ruling says INFORM and PROCEED rather than block. The sibling spec covers the
 * blocking half on a one-address wallet.
 *
 * NEEDS A CHAIN WHERE THIS WALLET HAS NO OTHER COINS. Leather onboards from a
 * fixed test seed, so its payment address is the SAME on every run and
 * accumulates change from every previous spec; with a clean coin in the pool the
 * guard answers `auto` and no notice is due. CI gives each job a fresh chain, so
 * this holds there; locally, run it first or reset the stack.
 *
 * What makes this worth a lane rather than a unit test: "enabled" and "the
 * notice is visible" are the same claim only if a reader can see both at once.
 * This asserts the CTA is enabled AND the notice naming the specific seeded
 * inscription is on screen, and photographs them together.
 */
test('funding-notice: a separate-address wallet is told what the coin carries and may proceed', async () => {
  test.setTimeout(300_000);

  const cubes = await context.newPage();
  await closeLeftoverExtensionPages(context, [cubes]);

  await cubes.route('**/api/v1/fees/recommended', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      body: JSON.stringify(recommendedFeesFixture({ fastestFee: 5, halfHourFee: 3, hourFee: 1 })),
    });
  });

  await cubes.goto(CUBES_URL, { waitUntil: 'domcontentloaded' });
  await expect(cubes.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });

  await openDetails(cubes, 'configurator-advanced');
  await fillCubeSides(cubes, CUBE_SIDE_IDS);

  // Pre-connect: this click opens the WALLET PICKER, not the checkout drawer,

  // so it must not wait for a drawer that cannot appear yet.

  await expect(cubes.locator('[data-testid="mint-cta"]')).toBeEnabled({ timeout: 30_000 });

  await cubes.locator('[data-testid="mint-cta"]').click();


  await expect(cubes.locator('[data-testid="wallet-picker-detected"]')).toBeVisible({ timeout: 10_000 });
  const knownPagesBeforeConnect = new Set(context.pages());
  await cubes.locator('[data-testid="wallet-connect-leather"]').click();

  const connectPopup = await waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeConnect,
    timeoutMs: 60_000,
    isApproval: async (p) => {
      if (!p.url().startsWith('chrome-extension://')) return false;
      await p.getByTestId('get-addresses-approve-button').waitFor({ state: 'visible', timeout: 60_000 });
      return true;
    },
  });
  await connectPopup.getByTestId('get-addresses-approve-button').click();
  await connectPopup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await cubes.bringToFront();
  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 45_000 });

  await openWalletPopover(cubes);
  const paymentAddr = ((await cubes.locator('[data-testid="wallet-popover-payment-address"]').getAttribute('title')) ?? '').trim();
  const ordinalsAddr = ((await cubes.locator('[data-testid="wallet-popover-ordinals-address"]').getAttribute('title')) ?? '').trim();
  // The premise of this spec, asserted rather than assumed: if these ever
  // collapsed to one address the wallet would be the blocking topology and this
  // spec would be testing the other case while still looking like this one.
  expect(paymentAddr).toMatch(/^bcrt1q/);
  expect(ordinalsAddr).toMatch(/^bcrt1p/);
  expect(paymentAddr).not.toBe(ordinalsAddr);
  await cubes.locator('[data-testid="wallet-connected-btn"]').click();

  // The ONLY coin, and it carries an inscription. No clean coin: that is what
  // makes the guard choose between informing and blocking.
  const dirty = await seedDirtyCoin({ asset: 'inscription', address: paymentAddr, valueSats: 300_000 });
  await waitForElectrsSync(mineBlocks(1));

  // PREMISE, asserted at the setup rather than discovered at the assertion:
  // this wallet's address must hold our seeded coin and nothing else. Leather's
  // seed is fixed, so every previous run of this spec left a dirty coin here,
  // and with two the notice may name the older one. That failure would surface
  // as "the notice does not mention our id", which reads like a rendering bug
  // and is a chain-state problem.
  const pool = await getUtxos(paymentAddr);
  expect(
    pool.map((u) => `${u.txid}:${u.vout}`),
    `this wallet must hold exactly the coin this run seeded. The chain is not fresh: ` +
    `run this spec first, or reset the stack (npm run e2e:regtest:down && npm run e2e:regtest:up).`,
  ).toEqual([`${dirty.txid}:${dirty.vout}`]);

  await cubes.reload({ waitUntil: 'domcontentloaded' });
  await expect(cubes.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });
  await openDetails(cubes, 'configurator-advanced');
  await fillCubeSides(cubes, CUBE_SIDE_IDS);
  await expect(cubes.locator('[data-testid="mint-cta"]')).toBeEnabled({ timeout: 60_000 });
  await cubes.locator('[data-testid="mint-cta"]').click();

  // INFORMED, not blocked.
  const notice = cubes.locator('[data-testid="mint-asset-notice"]');
  await expect(notice).toBeVisible({ timeout: 60_000 });
  await expect(cubes.locator('[data-testid="mint-expert-required"]')).toHaveCount(0);
  await expect(cubes.locator('[data-testid="mint-btn"]')).toBeEnabled();

  // The breakdown must not claim a content-clean pick while the notice names
  // what the coin carries. Found in the screenshot, not by an assertion: both
  // sentences were true-looking on their own and contradicted each other on one
  // screen.
  await expect(cubes.locator('[data-testid="mint-checkout"]')).not.toContainText('Best content-clean UTXO auto-picked');
  await expect(cubes.locator('[data-testid="mint-auto-pick-asset-note"]')).toBeVisible();

  // Names the SPECIFIC asset. "A notice appeared" would pass against a notice
  // describing a different coin.
  await expect(notice).toContainText(dirty.assetId);

  // Both in ONE viewport, because enabled is not permission to bury the notice.
  // If they cannot be seen together that is a finding about the layout.
  const shotTarget = cubes.locator('[data-testid="mint-checkout"]');
  await notice.scrollIntoViewIfNeeded();
  fs.mkdirSync(STATE_SHOTS, { recursive: true });
  await shotTarget.screenshot({ path: path.resolve(STATE_SHOTS, 'funding-notice-separate-address.png') });

  // Measured, not eyeballed: both boxes inside the viewport at once. "Enabled
  // and the notice is visible" is one claim only if a reader can see both
  // without scrolling, and a screenshot alone would not catch a regression that
  // pushes one of them off-screen.
  const noticeBox = await notice.boundingBox();
  const ctaBox = await cubes.locator('[data-testid="mint-btn"]').boundingBox();
  const viewport = cubes.viewportSize();
  expect(noticeBox, 'the notice must be laid out').toBeTruthy();
  expect(ctaBox, 'the CTA must be laid out').toBeTruthy();
  expect(
    Math.max(noticeBox!.y + noticeBox!.height, ctaBox!.y + ctaBox!.height),
    `notice ends at ${noticeBox!.y + noticeBox!.height}, CTA ends at ${ctaBox!.y + ctaBox!.height}, ` +
    `viewport is ${viewport!.height}: the reader cannot see the reason and the button together`,
  ).toBeLessThanOrEqual(viewport!.height);

  await cubes.close();
});
