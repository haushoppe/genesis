/**
 * @test-kind e2e
 * Real:   cubes app on the Angular dev server (ng serve -c regtest), regtest stack (bitcoind
 *         30, ordpool-electrs, cat21-ord, stock ord, ordpool-backend), Leather 6.102.0 (.crx)
 * Faked:  /api/v1/fees/recommended -> recommendedFeesFixture (ordpool-sdk, captured), tiers
 *         overridden to 5 / 3 / 1 sat/vB; Leather's vendor backends -> installLeatherOfflineRoutes
 *         (ordpool-sdk)
 * Proves: a separate-address wallet whose only coin carries a seeded inscription gets an
 *         enabled CTA and a notice naming that inscription, both inside one viewport, and
 *         the Mint click after the notice confirms a commit whose only input is that coin
 *         and a reveal ord indexes as the cube's HTML; any console.error or uncaught
 *         exception on an app page fails it
 */
/* eslint-disable no-console */
import { test, expect, BrowserContext, Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

import {
  CUBES_URL,
  expectMintSuccess,
  expectTipPaid,
  readWalletPopoverAddress,
  fillCubeSides,
  openDetails,
  RENDERABLE_SIDE_IDS,
  signPopupOrMintError,
} from '../regtest-helpers';
import {
  approvalGate,
  clickApprovalAndRequireClose,
  clickUntilEffect,
  closeLeftoverExtensionPages,
  onboardLeather,
  waitForApprovalPopup,
  seedDirtyCoin,
  getUtxos,
  waitForElectrsSync,
  rpc,
  mineBlocks,
  installContextErrorGuard,
  launchWalletContext,
  installLeatherOfflineRoutes,
  waitForTxConfirmed,
  waitForOrdStockSync,
  getStockOrdContent,
} from 'ordpool-sdk/e2e';
import { recommendedFeesFixture } from 'ordpool-sdk';

const EXT_PATH = path.resolve(__dirname, '../extensions/leather');
const RESULTS_DIR = path.resolve(__dirname, '../../../test-results-regtest');

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

  context = await launchWalletContext({
    wallet: 'leather',
    extensionPath: EXT_PATH,
    userDataDir: workingDir,
  });
  // Leather's vendor backends are answered locally or aborted, so the wallet
  // renders and signs without a server outside the test.
  await installLeatherOfflineRoutes(context);
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
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
test('funding-notice: a separate-address wallet is told what the coin carries and mints with it', async () => {
  // Fails the test on any console.error or uncaught exception from an app page
  // this context opens from here on; wallet extension pages are skipped by design.
  const errorGuard = installContextErrorGuard(context);
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
  await expect(cubes.locator('[data-testid="page-title"]')).toBeVisible();

  await openDetails(cubes, 'configurator-advanced');
  await fillCubeSides(cubes, CUBE_SIDE_IDS);

  // Pre-connect: this click opens the WALLET PICKER, not the checkout drawer,

  // so it must not wait for a drawer that cannot appear yet.

  await expect(cubes.locator('[data-testid="mint-cta"]')).toBeEnabled();

  // `mint-cta` is bound to funding state that settles after first paint, so
  // it can re-render between the locator resolving and the event landing.
  // Measured on the alby lane: swallowed in 3 of 6 observations, surfacing
  // as this effect simply never appearing.
  await clickUntilEffect(
    cubes.locator('[data-testid="mint-cta"]'),
    cubes.locator('[data-testid="wallet-picker-detected"]'),
    { label: 'mint-cta -> wallet-picker-detected' },
  );
  const knownPagesBeforeConnect = new Set(context.pages());
  await cubes.locator('[data-testid="wallet-connect-leather"]').click();

  const approveButton = (p: Page) => p.getByTestId('get-addresses-approve-button');
  const connectPopup = await waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeConnect,
    isApproval: approvalGate({ url: /^chrome-extension:\/\//, control: approveButton }),
  });
  // Leather closes the popup once it accepts the approval, so the close is the
  // proof the click landed.
  await clickApprovalAndRequireClose(approveButton(connectPopup), connectPopup, { label: 'Leather connect popup' });
  await cubes.bringToFront();
  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible();

  const paymentAddr = await readWalletPopoverAddress(cubes, 'wallet-popover-payment-address');
  const ordinalsAddr = await readWalletPopoverAddress(cubes, 'wallet-popover-ordinals-address');
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
  await expect(cubes.locator('[data-testid="page-title"]')).toBeVisible();
  await openDetails(cubes, 'configurator-advanced');
  await fillCubeSides(cubes, CUBE_SIDE_IDS);
  await expect(cubes.locator('[data-testid="mint-cta"]')).toBeEnabled();
  // The notice renders inside the drawer this click opens, so it is an
  // appears-once effect and the swallow guard fits.
  await clickUntilEffect(
    cubes.locator('[data-testid="mint-cta"]'),
    cubes.locator('[data-testid="mint-asset-notice"]'),
    { label: 'mint-cta -> mint-asset-notice' },
  );

  // INFORMED, not blocked.
  const notice = cubes.locator('[data-testid="mint-asset-notice"]');
  await expect(notice).toBeVisible();
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

  // PROCEEDS, not only enabled: the click after the notice mints, and the coin
  // it spends is the one the notice named. An enabled button whose click
  // throws before asking the wallet would pass every assertion above.
  const mintBtn = cubes.locator('[data-testid="mint-btn"]');
  await closeLeftoverExtensionPages(context, [cubes]);
  const knownPagesBeforeSign = new Set(context.pages());
  await mintBtn.click();

  const signButton = (p: Page) => p.getByRole('button', { name: /^(confirm|sign|approve)$/i }).first();
  const signPopup = await signPopupOrMintError(cubes, {
    context,
    knownPages: knownPagesBeforeSign,
    isApproval: approvalGate({ url: /^chrome-extension:\/\//, control: signButton }),
  });
  // Tolerates the popup closing under the click (an accepted approval), then
  // requires it to close; never re-clicks, a second click is a second signature.
  await clickApprovalAndRequireClose(signButton(signPopup), signPopup, { label: 'leather sign' });
  await expectMintSuccess(cubes);

  const commitTxId = (await cubes.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
  const revealTxId = (await cubes.locator('[data-testid="mint-reveal-txid"]').getAttribute('aria-label'))?.trim() ?? '';
  expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);
  expect(revealTxId).toMatch(/^[0-9a-f]{64}$/);

  await waitForElectrsSync(mineBlocks(1));
  const commitTx = await waitForTxConfirmed(commitTxId);
  // The commit spends exactly the coin the notice named.
  expect(commitTx.vin.map((i) => `${i.txid}:${i.vout}`)).toEqual([`${dirty.txid}:${dirty.vout}`]);
  await waitForElectrsSync(mineBlocks(1));
  const revealTx = await waitForTxConfirmed(revealTxId);
  expectTipPaid(commitTx, revealTx);

  await waitForOrdStockSync(Number(rpc('getblockcount').trim()));
  const { contentType } = await getStockOrdContent(`${revealTxId}i0`);
  expect(contentType).toBe('text/html;charset=utf-8');

  errorGuard.assertClean();
  await cubes.close();
});
