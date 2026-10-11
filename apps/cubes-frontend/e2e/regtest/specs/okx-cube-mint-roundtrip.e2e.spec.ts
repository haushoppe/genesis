/**
 * @test-kind e2e
 * Real:   cubes app on the Angular dev server (ng serve -c regtest), regtest stack (bitcoind
 *         30, ordpool-electrs, cat21-ord, stock ord, ordpool-backend), OKX 4.1.0 (.crx)
 * Faked:  /api/v1/fees/recommended -> recommendedFeesFixture (ordpool-sdk, captured), tiers
 *         overridden to 5 / 3 / 1 sat/vB; OKX's welcome tab -> installOkxOfflineRoutes
 *         (ordpool-sdk)
 * Proves: clicking through the mint form with OKX signing confirms a commit and reveal whose
 *         ord-indexed body equals getCubeHtml() for the typed sides (the app's own generator,
 *         so this half shares code), parses back to the typed side ids, and pays the tip
 *         exactly once; any console.error or uncaught exception on an app page fails it
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
  expectedRegtestCubeHtml,
  parseRegtestCube,
  openDetails,
  openMintCheckout,
  RENDERABLE_SIDE_IDS,
  signPopupOrMintError,
} from '../regtest-helpers';
import {
  approvalGate,
  approveOkxConnectPopup,
  clickApprovalAndRequireClose,
  clickUntilEffect,
  closeLeftoverExtensionPages,
  dismissOkxAssetTransferPromo,
  extensionOnboardingPage,
  installOkxOfflineRoutes,
  isOkxConnectApproval,
  onboardOkx,
  raceApprovalPopup,
  waitForElectrsSync,
  fundCommonSats,
  waitForTxConfirmed,
  rpc,
  mineBlocks,
  waitForOrdStockSync,
  getStockOrdContent,
  installContextErrorGuard,
  launchWalletContext,
} from 'ordpool-sdk/e2e';
import { recommendedFeesFixture } from 'ordpool-sdk';

/**
 * Full user-flow proof for OKX — cubes.haushoppe.art end-to-end on
 * regtest. Single-address wallet (BIP-86 P2TR default); same SDK
 * shim path as Unisat/Wizz (connector rewrite + wallet-side-address
 * signer shim); same cubes self-send gate skip.
 *
 * OKX-specific tricks (all from the SDK's proven okx-mint spec):
 *   - Onboarding uses `onboardOkx` from ordpool-sdk/e2e.
 *   - Context launched by `launchWalletContext({ wallet: 'okx' })`, which
 *     hides `navigator.webdriver` (OKX's popup detection sniffs for
 *     automation), on a fresh temporary profile (`userDataDir: ''`): OKX
 *     auto-opens its welcome page on extension install, and the SDK's
 *     `extensionOnboardingPage` returns that page for onboarding.
 *   - The connect request goes through the SDK's `approveOkxConnectPopup`,
 *     which finds it by OKX's `#/connect` route, so the "Confirm Trade" sign
 *     popup OKX may open during a connect never matches.
 *   - OKX reuses one `notification.html` page across approvals, and it
 *     may already be open when the click lands, so every search excludes
 *     only the app's own page, never the extension pages already open.
 *   - "Asset transfer pending" promo modal may cover Confirm: the SDK's
 *     `dismissOkxAssetTransferPromo` closes it first.
 */

const EXT_PATH = path.resolve(__dirname, '../extensions/okx');
const RESULTS_DIR = path.resolve(__dirname, '../../../test-results-regtest');
const FUND_AMOUNT_BTC = 0.002;

const CUBE_SIDE_IDS = RENDERABLE_SIDE_IDS;

let context: BrowserContext;
let extensionId: string;
let onboardPage: Page;

async function shot(p: Page, name: string): Promise<void> {
  await p.screenshot({
    path: path.resolve(RESULTS_DIR, `okx-cube-mint-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
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

  // SDK spec parity: empty user-data-dir string (Chromium creates a fresh
  // profile), and onboarding on the welcome tab OKX opens on install.
  context = await launchWalletContext({
    wallet: 'okx',
    extensionPath: EXT_PATH,
    userDataDir: '',
  });
  // Hermetic OKX: the vendor web page its onboarding opens in a normal tab is
  // answered locally, so no marketing page or its trackers run in the test.
  await installOkxOfflineRoutes(context);
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  extensionId = worker.url().split('/')[2];

  onboardPage = await extensionOnboardingPage(context, extensionId);
  await onboardOkx(onboardPage, extensionId);
  await shot(onboardPage, '00-onboarded');
  // Do NOT close onboardPage — the OKX suite reuses it for the
  // wallet-approval popup Page reference (SDK spec pattern).
});

test.afterAll(async () => {
  await context?.close();
});

test('mint a cube via OKX: fill form → sign in wallet → broadcast → ord indexes the HTML byte-for-byte', async () => {
  // Fails the test on any console.error or uncaught exception from an app page
  // this context opens from here on; wallet extension pages are skipped by design.
  const errorGuard = installContextErrorGuard(context);
  const cubes = await context.newPage();
  /** OKX may serve an approval from a page that is already open: only the app's page is excluded. */
  const appPageOnly = () => new Set<Page>([cubes]);

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
  await expect(cubes.locator('[data-testid="page-title"]')).toBeVisible();

  await openDetails(cubes, 'configurator-advanced');
  await fillCubeSides(cubes, CUBE_SIDE_IDS);
  await shot(cubes, '02a-form-filled');

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
  const connectLink = cubes.locator('[data-testid="wallet-connect-okx"]');
  await expect(connectLink).toBeVisible();
  await shot(cubes, '02b-wallet-picker-open');

  await connectLink.click();
  await approveOkxConnectPopup({ context });
  await cubes.bringToFront();

  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible();

  const paymentAddr = await readWalletPopoverAddress(cubes, 'wallet-popover-payment-address');
  // OKX's default is BIP-86 Taproot (bcrt1p on regtest).
  expect(paymentAddr).toMatch(/^bcrt1[qp]|^2/);
  console.log(`[okx-mint] payment address: ${paymentAddr}`);
  await cubes.locator('[data-testid="wallet-connected-btn"]').click();

  await fundCommonSats(paymentAddr, FUND_AMOUNT_BTC);

  await cubes.reload({ waitUntil: 'domcontentloaded' });

  // OKX may ask to approve the connection again after the reload, or reuse
  // its cached authorisation. The header's connected button exists only once
  // the reconnect resolved, so it is the state that means no popup is coming.
  const reconnect = await raceApprovalPopup({
    context,
    knownPages: appPageOnly(),
    isApproval: isOkxConnectApproval,
    noPopupState: cubes.locator('[data-testid="wallet-connected-btn"]'),
  });
  // The SDK helper finds that same page again: its search is by URL, not by
  // which pages were open before.
  if (reconnect.outcome === 'popup') await approveOkxConnectPopup({ context });
  await cubes.bringToFront();
  await expect(cubes.locator('[data-testid="wallet-connected-btn"]')).toBeVisible();

  await openDetails(cubes, 'configurator-advanced');
  await fillCubeSides(cubes, CUBE_SIDE_IDS);
  await openMintCheckout(cubes);
  await openDetails(cubes, 'mint-advanced');
  await expect(cubes.locator('[data-testid="cube-fee-rate"]')).toBeVisible();
  await cubes.locator('[data-testid="cube-fee-rate"]').fill('5');
  await shot(cubes, '04-drawer-open');

  const expectedCubeHtml = expectedRegtestCubeHtml({
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
  await expect(mintBtn).toBeEnabled();

  await closeLeftoverExtensionPages(context, [cubes]);
  await mintBtn.click();

  const confirmButton = (p: Page) => p.getByText('Confirm', { exact: true }).first();
  const signPopup = await signPopupOrMintError(cubes, {
    context,
    knownPages: appPageOnly(),
    isApproval: approvalGate({ url: /^chrome-extension:\/\//, control: confirmButton }),
  });
  await shot(signPopup, '05a-sign-popup');
  await dismissOkxAssetTransferPromo(signPopup);
  await shot(signPopup, '05b-post-promo-dismiss');
  await clickApprovalAndRequireClose(confirmButton(signPopup), signPopup, { label: 'OKX sign popup' });
  console.log('[okx-mint] sign approved; waiting for mint-success');

  await expectMintSuccess(cubes);
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

  const parsed = parseRegtestCube(onChainHtml);
  expect(parsed).toBeTruthy();
  const parsedSides = parsed!
    .filter((t) => /^Side \d$/.test(t.trait_type))
    .sort((a, b) => a.trait_type.localeCompare(b.trait_type))
    .map((t) => t.value);
  expect(parsedSides).toEqual(CUBE_SIDE_IDS);

  errorGuard.assertClean();
});
