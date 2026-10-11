/**
 * @test-kind e2e
 * Real:   cubes app on the Angular dev server (ng serve -c regtest), regtest stack (bitcoind
 *         30, ordpool-electrs, cat21-ord, stock ord, ordpool-backend), Wizz 2.13.4 (.crx)
 * Faked:  /api/v1/fees/recommended -> recommendedFeesFixture (ordpool-sdk, captured), tiers
 *         overridden to 5 / 3 / 1 sat/vB; Wizz's vendor backend -> installWizzOfflineRoutes
 *         (ordpool-sdk)
 * Proves: clicking through the mint form with Wizz signing confirms a commit and reveal whose
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
  approveWizzSignPopup,
  clickApprovalAndRequireClose,
  clickUntilEffect,
  closeLeftoverExtensionPages,
  installWizzOfflineRoutes,
  onboardWizz,
  raceApprovalPopup,
  waitForApprovalPopup,
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

const FUND_AMOUNT_BTC = 0.002;

const CUBE_SIDE_IDS = RENDERABLE_SIDE_IDS;

let context: BrowserContext;
let extensionId: string;

async function shot(p: Page, name: string): Promise<void> {
  await p.screenshot({
    path: path.resolve(RESULTS_DIR, `wizz-cube-mint-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
}

/** Wizz inherits Unisat's connect approval: Connect is a styled div, matched by text. */
const wizzConnectButton = (p: Page) => p.getByText(/^Connect$/).first();
const wizzConnectApproval = approvalGate({
  url: /notification\.html#\/approval/,
  control: wizzConnectButton,
});

// local: Wizz's connect approval; ordpool-sdk/e2e exports a Wizz sign helper only.
/** Click Connect and require the popup to close: Wizz closes it once it accepts. */
async function approveWizzConnect(approval: Page): Promise<void> {
  await shot(approval, '03a-connect-popup');
  await clickApprovalAndRequireClose(wizzConnectButton(approval), approval, { label: 'Wizz connect popup' });
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

  context = await launchWalletContext({
    wallet: 'wizz',
    extensionPath: EXT_PATH,
    userDataDir: workingDir,
  });
  // Hermetic Wizz: abort the hanging configs.wizz.cash remote-config fetch
  // and stub the wallet's third-party balance/asset backends so the sign
  // popup can enable Sign without Wizz server uptime. The stub shapes were
  // reverse-engineered from the Wizz v2.13.4 bundle here and now live as
  // the canonical helper in ordpool-sdk/e2e.
  await installWizzOfflineRoutes(context);

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
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
  // Fails the test on any console.error or uncaught exception from an app page
  // this context opens from here on; wallet extension pages are skipped by design.
  const errorGuard = installContextErrorGuard(context);
  const cubes = await context.newPage();

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
  const connectLink = cubes.locator('[data-testid="wallet-connect-wizz"]');
  await expect(connectLink).toBeVisible();
  await shot(cubes, '02b-wallet-picker-open');

  const knownPagesBeforeConnect = new Set(context.pages());
  await connectLink.click();
  await approveWizzConnect(await waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeConnect,
    isApproval: wizzConnectApproval,
  }));
  await cubes.bringToFront();

  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible();

  const paymentAddr = await readWalletPopoverAddress(cubes, 'wallet-popover-payment-address');
  expect(paymentAddr).toMatch(/^bcrt1q/);
  console.log(`[wizz-mint] payment address: ${paymentAddr}`);
  await cubes.locator('[data-testid="wallet-connected-btn"]').click();

  await fundCommonSats(paymentAddr, FUND_AMOUNT_BTC);

  const knownPagesBeforeReconnect = new Set(context.pages());
  await cubes.reload({ waitUntil: 'domcontentloaded' });

  // Wizz may ask to approve the connection again after the reload, or
  // reconnect silently. The header's connected button exists only once the
  // reconnect resolved, so it is the state that means no popup is coming.
  const reconnect = await raceApprovalPopup({
    context,
    knownPages: knownPagesBeforeReconnect,
    isApproval: wizzConnectApproval,
    noPopupState: cubes.locator('[data-testid="wallet-connected-btn"]'),
  });
  if (reconnect.outcome === 'popup') await approveWizzConnect(reconnect.page);
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
  const knownPagesBeforeSign = new Set(context.pages());
  await mintBtn.click();

  // The race only proves a sign popup opened instead of a mint error;
  // approveWizzSignPopup then finds that same popup, since it is not in
  // knownPagesBeforeSign either.
  await signPopupOrMintError(cubes, {
    context,
    knownPages: knownPagesBeforeSign,
    isApproval: approvalGate({
      url: /notification\.html#\/approval/,
      control: (p) => p.getByRole('button', { name: 'Sign' }),
    }),
  });
  await approveWizzSignPopup({
    context,
    knownPages: knownPagesBeforeSign,
    onScreenshot: (p, name) => shot(p, `05a-${name}`),
  });

  await expectMintSuccess(cubes);
  await shot(cubes, '06-success');

  const commitTxId = (await cubes.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
  const revealTxId = (await cubes.locator('[data-testid="mint-reveal-txid"]').getAttribute('aria-label'))?.trim() ?? '';
  expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);
  expect(revealTxId).toMatch(/^[0-9a-f]{64}$/);
  console.log(`[wizz-mint] commit=${commitTxId.slice(0, 12)}… reveal=${revealTxId.slice(0, 12)}…`);

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
