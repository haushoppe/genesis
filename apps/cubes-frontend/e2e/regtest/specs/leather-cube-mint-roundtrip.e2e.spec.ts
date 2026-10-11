/**
 * @test-kind e2e
 * Real:   cubes app on the Angular dev server (ng serve -c regtest), regtest stack (bitcoind
 *         30, ordpool-electrs, cat21-ord, stock ord, ordpool-backend), Leather 6.102.0 (.crx)
 * Faked:  /api/v1/fees/recommended -> recommendedFeesFixture (ordpool-sdk, captured), tiers
 *         overridden to 5 / 3 / 1 sat/vB
 * Proves: clicking through the mint form with Leather signing confirms a commit and reveal
 *         whose ord-indexed body equals getCubeHtml() for the typed sides (the app's own
 *         generator, so this half shares code), parses back to the typed side ids, and pays
 *         the tip exactly once; any console.error or uncaught exception on an app page fails
 *         it
 */
/* eslint-disable no-console */
import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
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
  clickApprovalAndRequireClose,
  clickUntilEffect,
  closeLeftoverExtensionPages,
  onboardLeather,
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
} from 'ordpool-sdk/e2e';
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
 * Same runtime facts as cat21-wallet's spec:
 *   - `get-addresses-approve-button` testid (shared Leather DOM).
 *   - Leather closes each approval popup itself once it accepts the click,
 *     so every approval requires that close rather than closing the popup
 *     from the test, which would cut the address dispatch short.
 *
 * If mint-success + on-chain byte-for-byte HTML check both pass,
 * we've proved: user clicked → Leather signed a regtest PSBT with
 * `network: 'mainnet'` → chain accepted → ord indexed → the bytes
 * on-chain are exactly the cube the preview iframe rendered.
 */

const EXT_PATH = path.resolve(__dirname, '../extensions/leather');
const RESULTS_DIR = path.resolve(__dirname, '../../../test-results-regtest');

/** Same 0.002 BTC budget as the other cubes specs — covers commit +
 *  reveal fees + postage + tip at 5 sat/vB. */
const FUND_AMOUNT_BTC = 0.002;

/** Six valid-format inscription IDs; the ord cube-parser doesn't
 *  dereference `/content/<id>` while walking, so unresolvable IDs
 *  are fine as long as they pass `isValidInscriptionId`. */
const CUBE_SIDE_IDS = RENDERABLE_SIDE_IDS;

let context: BrowserContext;
let extensionId: string;

async function shot(p: Page, name: string): Promise<void> {
  await p.screenshot({
    path: path.resolve(RESULTS_DIR, `leather-cube-mint-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
}

const leatherApproveButton = (p: Page) => p.getByTestId('get-addresses-approve-button');
const leatherConnectApproval = approvalGate({ url: /^chrome-extension:\/\//, control: leatherApproveButton });

// local: Leather's connect approval; ordpool-sdk/e2e has no Leather approval helper.
/** Approve the address request and require the popup to close. */
async function approveLeatherConnect(approval: Page): Promise<void> {
  await shot(approval, '03a-connect-popup');
  await clickApprovalAndRequireClose(leatherApproveButton(approval), approval, { label: 'Leather connect popup' });
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

test('mint a cube via Leather: fill form → sign in wallet → broadcast → ord indexes the HTML byte-for-byte', async () => {
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
  const connectLink = cubes.locator('[data-testid="wallet-connect-leather"]');
  await expect(connectLink).toBeVisible();
  await shot(cubes, '02b-wallet-picker-open');

  const knownPagesBeforeConnect = new Set(context.pages());
  await connectLink.click();

  await approveLeatherConnect(await waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeConnect,
    isApproval: leatherConnectApproval,
  }));
  await cubes.bringToFront();

  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible();

  const paymentAddr = await readWalletPopoverAddress(cubes, 'wallet-popover-payment-address');
  // The shim's whole point: Leather returns mainnet at the connector,
  // the SDK shim rewrites to bcrt before the app sees it.
  expect(paymentAddr).toMatch(/^bcrt1q/);
  console.log(`[leather-mint] payment address: ${paymentAddr}`);
  await cubes.locator('[data-testid="wallet-connected-btn"]').click();

  await fundCommonSats(paymentAddr, FUND_AMOUNT_BTC);

  const knownPagesBeforeReconnect = new Set(context.pages());
  await cubes.reload({ waitUntil: 'domcontentloaded' });

  // Leather may ask to approve the addresses again after the reload, or
  // reconnect silently. Post-reload the mint drawer is closed, so the
  // always-visible header button is the reconnected state, and it exists
  // only once the reconnect resolved: the state that means no popup is coming.
  const reconnect = await raceApprovalPopup({
    context,
    knownPages: knownPagesBeforeReconnect,
    isApproval: leatherConnectApproval,
    noPopupState: cubes.locator('[data-testid="wallet-connected-btn"]'),
  });
  if (reconnect.outcome === 'popup') await approveLeatherConnect(reconnect.page);
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

  const signButton = (p: Page) => p.getByRole('button', { name: /^(confirm|sign|approve)$/i }).first();
  const signPopup = await signPopupOrMintError(cubes, {
    context,
    knownPages: knownPagesBeforeSign,
    isApproval: approvalGate({ url: /^chrome-extension:\/\//, control: signButton }),
  });
  await shot(signPopup, '05a-sign-popup');
  // Tolerates the popup closing under the click (an accepted approval), then
  // requires it to close; never re-clicks, a second click is a second signature.
  await clickApprovalAndRequireClose(signButton(signPopup), signPopup, { label: 'leather sign' });
  console.log('[leather-mint] sign approved; waiting for mint-success');

  await expectMintSuccess(cubes);
  await shot(cubes, '06-success');

  const commitTxId = (await cubes.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
  const revealTxId = (await cubes.locator('[data-testid="mint-reveal-txid"]').getAttribute('aria-label'))?.trim() ?? '';
  expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);
  expect(revealTxId).toMatch(/^[0-9a-f]{64}$/);
  console.log(`[leather-mint] commit=${commitTxId.slice(0, 12)}… reveal=${revealTxId.slice(0, 12)}…`);

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
