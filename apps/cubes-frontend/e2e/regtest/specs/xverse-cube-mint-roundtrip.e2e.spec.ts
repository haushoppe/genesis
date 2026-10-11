/**
 * @test-kind e2e
 * Real:   cubes app on the Angular dev server (ng serve -c regtest), regtest stack (bitcoind
 *         30, ordpool-electrs, cat21-ord, stock ord, ordpool-backend), Xverse 2.3.2 (.crx)
 * Faked:  /api/v1/fees/recommended -> recommendedFeesFixture (ordpool-sdk, captured), tiers
 *         overridden to 5 / 3 / 1 sat/vB; Xverse's vendor backends -> installXverseOfflineRoutes
 *         (ordpool-sdk)
 * Proves: clicking through the mint form with Xverse signing confirms a commit and reveal
 *         whose ord-indexed body equals getCubeHtml() for the typed sides (the app's own
 *         generator, so this half shares code), parses back to the typed side ids, and pays
 *         the tip exactly once; any console.error or uncaught exception on an app page fails
 *         it; the fee tiers and the found-funds breakdown render
 */
import { test, expect, chromium, BrowserContext, Locator, Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

// SEED_USER_DATA_DIR is imported, never re-derived: global-setup owns where
// the seed lives, and a second hand-maintained copy of that path reads the
// wrong place, silently, the moment the first one moves.
import { SEED_USER_DATA_DIR } from '../global-setup';
import {
  CUBES_URL,
  expectMintSuccess,
  expectTipPaid,
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
  installXverseOfflineRoutes,
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
 * Full user-flow proof for the Xverse wallet: the actual cubes-frontend
 * UI, wired against the regtest stack (bitcoind + electrs + ord-stock).
 * Nothing about the mint path is mocked: the wallet .crx is real, the
 * chain is real, the ord instance is real, the cube HTML that gets
 * inscribed is the exact HTML the on-page iframe preview renders.
 *
 * Flow (checkout-drawer UX: cube configurator is always visible; the
 * wallet-picker, fee-rate, and confirm button live inside a drawer that
 * only opens after `mint-cta` is clicked):
 *   1. beforeAll: clone the Xverse seed user-data-dir (populated once
 *      per suite by global-setup.ts), launch headed Chromium with the
 *      unpacked Xverse .crx, extract the extension id from the SW URL.
 *   2. Test: unlock Xverse; navigate to cubes-frontend; fill
 *      the six side inputs (needed to enable the mint CTA); click
 *      the top-level `mint-cta` to open the checkout drawer.
 *   3. Inside the drawer: click Connect Xverse; approve the connect
 *      popup; assert "Connected as bcrt1p…" appears; read the payment
 *      address from the DOM.
 *   4. Fund the payment address via bitcoin-cli; mine + electrs-sync.
 *   5. Reload the page (the orchestrator's utxos$ chain runs once per
 *      wallet-connect, and funding AFTER connect doesn't re-trigger it).
 *      Re-fill the six inputs, re-open the drawer via `mint-cta`, set
 *      the fee rate.
 *   6. Snapshot the exact cube HTML the preview will inscribe.
 *   7. Click the drawer's confirm `mint-btn`. Approve the sign popup.
 *      Await the on-page success alert; parse the commit + reveal
 *      txids from it.
 *   8. Mine 1 block per tx so both confirm. Wait for ord-stock to
 *      catch up.
 *   9. Fetch `ord/inscription/<revealId>i0`; assert it's indexed.
 *      Fetch `ord/content/<id>`; byte-compare against the snapshot;
 *      round-trip through parseCube; the parsed inscriptionIds
 *      must match what the form was filled with.
 *
 * If step 8 succeeds, we've proved: user clicked → wallet signed →
 * chain accepted → ord indexed → the bytes on-chain are a real cube.
 */

const EXT_PATH = path.resolve(__dirname, '../extensions/xverse');
const RESULTS_DIR = path.resolve(__dirname, '../../../test-results-regtest');
const TEST_PASSWORD = 'TestPassword123!';

/**
 * ~200k sats, comfortably covers postage (546) + reveal fee + tip
 * (1000) + commit fee at 5 sat/vB with plenty of headroom for the
 * change output to clear the P2TR dust floor (330 sat).
 */
const FUND_AMOUNT_BTC = 0.002;

/** The six sides, inscribed on this chain by e2e/regtest/inscribe-fixtures.sh. */
const CUBE_SIDE_IDS = RENDERABLE_SIDE_IDS;

let context: BrowserContext;
let extensionId: string;

async function shot(p: Page, name: string): Promise<void> {
  await p.screenshot({
    path: path.resolve(RESULTS_DIR, `xverse-cube-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
}

/** Xverse's address request: a Connect button on an extension page. */
const xverseConnectButton = (p: Page) => p.getByRole('button', { name: /^connect$/i }).first();
const xverseConnectApproval = approvalGate({ url: /^chrome-extension:\/\//, control: xverseConnectButton });

// local: Xverse's address-request approval; ordpool-sdk/e2e has no Xverse approval helper.
/**
 * Approve an Xverse address request. Xverse keeps the popup open after the
 * approval, so the click's effect is the app state `connected`, and the popup
 * is closed only after it: leaving it open pollutes the extension page list,
 * and Xverse may reuse it for the sign popup, hiding it behind the knownPages
 * filter later in the flow.
 */
async function approveXverseConnect(popup: Page, connected: Locator): Promise<void> {
  await shot(popup, '03a-xverse-popup');
  const connect = xverseConnectButton(popup);
  await expect(connect).toBeEnabled();
  await connect.click();
  await expect(connected).toBeVisible();
  if (!popup.isClosed()) await popup.close();
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
  // context but skip the onboarding click flow. Strip Chromium's
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
  // Hermetic Xverse: its vendor backends (Xverse API, its esplora, Spark,
  // Mixpanel, …) are answered locally or refused, so the wallet's popups
  // render without waiting on servers outside the test.
  await installXverseOfflineRoutes(context);
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  extensionId = worker.url().split('/')[2];
});

test.afterAll(async () => {
  await context?.close();
});

test('mint a cube via xverse: fill form → sign in wallet → broadcast → ord indexes the HTML byte-for-byte', async () => {
  // ─── Step 1: unlock Xverse from the primer popup ───────────────
  const primer = await context.newPage();
  await primer.setViewportSize({ width: 400, height: 800 });
  await primer.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await primer.waitForFunction(() => {
    const t = (document.body.innerText || '').toLowerCase();
    return t.includes('unlock') || t.includes('account 1');
  }, undefined, { polling: 250 });
  if (/unlock/i.test(await primer.locator('body').innerText())) {
    await primer.locator('input[type="password"]').first().fill(TEST_PASSWORD);
    await primer.getByRole('button', { name: /^unlock$/i }).first().click();
    await primer.waitForFunction(() => {
      const t = (document.body.innerText || '').toLowerCase();
      return t.includes('account 1') || t.includes('not now') || t.includes('zest');
    }, undefined, { polling: 250 });
  }
  // The wait above ends on the dashboard or on its "Not now" prompt, so the
  // prompt is either on screen now or not coming.
  const notNow = primer.getByText('Not now', { exact: true }).first();
  if (await notNow.isVisible()) await notNow.click();
  await shot(primer, '01-xverse-unlocked');
  // Close the dashboard immediately after unlock: cat21-indexer's proven
  // regtest spec does this, and keeping it open confuses Xverse's SW when it
  // later needs to spawn a sign popup.
  await primer.close();

  // ─── Step 2: open cubes-frontend + connect wallet via UI ───────
  // Fails the test on any console.error or uncaught exception from an app page
  // this context opens from here on; wallet extension pages are skipped by design.
  const errorGuard = installContextErrorGuard(context);
  const cubes = await context.newPage();

  // Fixed fee tiers so the fee-tier button assertions below have
  // deterministic content to check.
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

  // Normal users lean on the auto-suggested cube; the six side inputs
  // are hidden behind the "Customize" <details>. This spec pins the
  // exact IDs it later checks on-chain, so we open the details first
  // and fill them explicitly.
  await openDetails(cubes, 'configurator-advanced');
  await fillCubeSides(cubes, CUBE_SIDE_IDS);
  await shot(cubes, '02a-form-filled-preflight');

  await expect(cubes.locator('[data-testid="mint-cta"]')).toBeEnabled();
  // `mint-cta` re-renders from funding state that settles after first paint,
  // so the click can be swallowed: measured on the alby lane in 3 of 6 runs.
  // Not connected yet, so the click opens the wallet picker; the drawer opens
  // by itself once a wallet lands (the `pendingCheckout` effect in
  // start.component).
  await clickUntilEffect(
    cubes.locator('[data-testid="mint-cta"]'),
    cubes.locator('[data-testid="wallet-picker-detected"]'),
    { label: 'mint-cta -> wallet-picker-detected' },
  );
  const connectLink = cubes.locator('[data-testid="wallet-connect-xverse"]');
  await expect(connectLink).toBeVisible();
  await shot(cubes, '02b-wallet-picker-open');

  // Click "Xverse": the SDK's WalletService.connectWallet fires
  // xverseConnector.connect, which spawns Xverse's approval popup.
  const knownPagesBeforeConnect = new Set(context.pages());
  await connectLink.click();
  await approveXverseConnect(
    await waitForApprovalPopup({ context, knownPages: knownPagesBeforeConnect, isApproval: xverseConnectApproval }),
    cubes.locator('[data-testid="wallet-connected"]'),
  );
  await cubes.bringToFront();

  // Read paymentAddress from the DOM (start.component renders it via
  // data-testid="mint-payment-address"). Same pattern cat21.space uses.
  const paymentAddrLocator = cubes.locator('[data-testid="mint-payment-address"]');
  await expect(paymentAddrLocator).toBeVisible();
  const paymentAddr = (await paymentAddrLocator.getAttribute('aria-label'))?.trim() ?? '';
  expect(paymentAddr).toMatch(/^bcrt1q|^bcrt1p|^m[a-zA-Z0-9]/);
  console.log(`[cube-mint] payment address: ${paymentAddr}`);

  // ─── Step 3: fund the payment address on regtest ───────────────
  await fundCommonSats(paymentAddr, FUND_AMOUNT_BTC);

  // ─── Step 4: reload page to re-fire the UTXO fetch ────────────
  // Orchestrator's utxos$ chain runs once per wallet-connect. Funding
  // the wallet AFTER connect doesn't retrigger it; a reload does.
  // Same pattern cat21.space's mint spec follows. The reload closes
  // the drawer (checkoutOpen resets to false) and clears the form;
  // we re-fill, re-open, and set the fee below.
  await reloadAndReconnect(cubes);

  // Refill the six sides: form state doesn't persist across reload.
  await openDetails(cubes, 'configurator-advanced');
  await fillCubeSides(cubes, CUBE_SIDE_IDS);
  await openMintCheckout(cubes);
  // Fee-rate + tier presets + UTXO breakdown live behind the drawer's
  // "Advanced" <details>.
  await openDetails(cubes, 'mint-advanced');
  await expect(cubes.locator('[data-testid="cube-fee-rate"]')).toBeVisible();
  await cubes.locator('[data-testid="cube-fee-rate"]').fill('5');
  await shot(cubes, '04b-drawer-reopened-after-reload');

  // ─── Step 5: compute the cube HTML the orchestrator will inscribe.
  // getCubeHtml is a pure function (services/cube-html.ts): the preview
  // iframe renders exactly what this returns, and start.component.ts
  // encodes the same string as the inscription body.
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

  // ─── Step 5b: the wallet reconnected after the reload, inside the drawer.
  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible();

  // ─── Step 5c: Xverse returned the SAME payment address post-reload.
  //   The orchestrator queries the address the wallet hands back, so a
  //   different one would hold no funds and the mint would wait on a
  //   UTXO that does not exist. If they differ, fund the new one too and
  //   reload once more so the orchestrator's utxos$ re-fires.
  const paymentAddrAfterReload = (await paymentAddrLocator.getAttribute('aria-label'))?.trim() ?? '';
  console.log(`[cube-mint] payment address after reload: ${paymentAddrAfterReload}`);
  if (paymentAddrAfterReload !== paymentAddr) {
    console.log(`[cube-mint] address changed across reload: ${paymentAddr} -> ${paymentAddrAfterReload}, refunding`);
    await fundCommonSats(paymentAddrAfterReload, FUND_AMOUNT_BTC);
    await reloadAndReconnect(cubes);
    await openDetails(cubes, 'configurator-advanced');
    await fillCubeSides(cubes, CUBE_SIDE_IDS);
    await openMintCheckout(cubes);
    await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible();
    await openDetails(cubes, 'mint-advanced');
    await expect(cubes.locator('[data-testid="cube-fee-rate"]')).toBeVisible();
    await cubes.locator('[data-testid="cube-fee-rate"]').fill('5');
  }

  // ─── Step 6: Mint is enabled once canMint() holds:
  //   viableRows > 0 && selectedUtxo != null && state === 'ready' && form.valid()
  //   which is exactly what the mint-btn's [disabled] reads.
  const mintBtnLocator = cubes.locator('[data-testid="mint-btn"]');
  await expect(mintBtnLocator).toBeEnabled();
  await shot(cubes, '05-mint-btn-enabled');

  // Interior-content assertions. The #61662 bug lets Angular mount a
  // container div but leave every interior binding empty. `toBeVisible` on
  // the outer div isn't enough; we prove the numbers inside rendered.
  await expect(cubes.locator('[data-testid="fee-tier-eco"]')).toContainText(/Eco \d+/);
  await expect(cubes.locator('[data-testid="fee-tier-hour"]')).toContainText(/Hour \d+/);
  await expect(cubes.locator('[data-testid="fee-tier-half"]')).toContainText(/Half \d+/);
  await expect(cubes.locator('[data-testid="fee-tier-fast"]')).toContainText(/Fast \d+/);
  await expect(cubes.locator('[data-testid="mint-found-funds-source"]')).toContainText(/[0-9a-f]{12}…:\d+/);
  await expect(cubes.locator('[data-testid="mint-found-funds-available"]')).toContainText(/\d[\d,\s]*\s*sat/);
  await expect(cubes.locator('[data-testid="mint-found-funds-miner-fee"]')).toContainText(/commit \d+ \+ reveal \d+ = \d+ sat/);

  // Xverse routinely leaves a leftover chrome-extension "dashboard" page
  // open after the connect approval. When we click mint, Xverse may reuse
  // that leftover for the sign popup, but knownPages filters it out, so the
  // search would think no sign popup ever appeared. Close everything but the
  // app page before capturing the baseline.
  await closeLeftoverExtensionPages(context, [cubes]);
  const knownPagesBeforeMint = new Set(context.pages());
  await mintBtnLocator.click();

  // Xverse's regtest flow may re-prompt for address confirmation on a sign
  // request: the FIRST popup after the mint click can be an address request
  // (a Connect popup) instead of the sign popup ("Review transaction").
  // Either one is the popup; a mint error instead is reported with its text.
  const reviewTransaction = (p: Page) => p.getByText(/review transaction/i).first();
  const firstPopup = await signPopupOrMintError(cubes, {
    context,
    knownPages: knownPagesBeforeMint,
    isApproval: approvalGate({
      url: /^chrome-extension:\/\//,
      control: (p) => xverseConnectButton(p).or(reviewTransaction(p)).first(),
    }),
  });
  console.log(`[cube-mint] first post-mint popup at ${firstPopup.url()}`);
  await shot(firstPopup, '05a-xverse-first-popup');

  // The gate above resolved on one of the two controls, so this reads which.
  let signPopup = firstPopup;
  if (await xverseConnectButton(firstPopup).isVisible()) {
    console.log('[cube-mint] first post-mint popup is address-select; approving to unlock sign popup');
    const knownPagesBeforeSign = new Set(context.pages());
    await xverseConnectButton(firstPopup).click();
    signPopup = await waitForApprovalPopup({
      context,
      knownPages: knownPagesBeforeSign,
      isApproval: approvalGate({ url: /^chrome-extension:\/\//, control: reviewTransaction }),
    });
  }
  await shot(signPopup, '05-xverse-sign-approval');

  // Wait for a rendered + enabled Confirm button: Xverse's Vite SPA renders
  // the button before its click handler wires up, so a click on a button that
  // does not yet take pointer events is swallowed.
  await signPopup.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some((b) => {
      if (!/^confirm$/i.test(b.textContent?.trim() ?? '')) return false;
      if (b.hasAttribute('disabled')) return false;
      const style = getComputedStyle(b);
      return style.pointerEvents !== 'none' && style.visibility !== 'hidden';
    });
  }, undefined, { polling: 250 });
  const confirm = signPopup.getByRole('button', { name: /^confirm$/i }).first();
  await expect(confirm).toBeEnabled();
  console.log('[cube-mint] clicking Confirm on sign popup');
  // Tolerates the popup closing under the click (an accepted approval), then
  // requires it to close; never re-clicks, a second click is a second signature.
  await clickApprovalAndRequireClose(confirm, signPopup, { label: 'Xverse sign popup' });
  console.log('[cube-mint] Confirm clicked, waiting for mint-success');

  // Success, plus the ARIA-state proof that the mint button dropped out of
  // its `minting` phase.
  await expectMintSuccess(cubes);
  await shot(cubes, '06-cubes-success');

  const commitTxId = (await cubes.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
  const revealTxId = (await cubes.locator('[data-testid="mint-reveal-txid"]').getAttribute('aria-label'))?.trim() ?? '';
  expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);
  expect(revealTxId).toMatch(/^[0-9a-f]{64}$/);
  console.log(`[cube-mint] commit=${commitTxId.slice(0, 12)}… reveal=${revealTxId.slice(0, 12)}…`);

  // ─── "My cubes" (pending-path): the just-minted cube must appear
  //     in the myCubes signal via the localStorage overlay, since the
  //     public cubes.json index hasn't caught up yet. Full self-cleanup
  //     (the localStorage entry drops once the index has it) is
  //     unit-tested in past-mints.service.vitest.ts.
  const myList = cubes.getByTestId('my-cubes-list');
  await expect(myList).toBeVisible();
  await expect(myList).toContainText(revealTxId.slice(0, 12));
  // A just-minted, not-yet-mined item carries the live mempool badge
  // ("⏳ In the mempool"); it flips to "confirmed" once mined.
  await expect(myList.locator('li').filter({ hasText: revealTxId.slice(0, 12) })
      .locator('[data-testid^="my-cube-badge"]'))
    .toContainText(/mempool/i);

  // ─── Step 7: mine both txs into blocks ─────────────────────────
  await waitForElectrsSync(mineBlocks(1));
  const commitTx = await waitForTxConfirmed(commitTxId);
  await waitForElectrsSync(mineBlocks(1));
  const revealTx = await waitForTxConfirmed(revealTxId);
  expectTipPaid(commitTx, revealTx);
  expect(revealTx.status.block_hash).toBeTruthy();

  // ─── Step 8: ord indexes the cube ─────────────────────────────
  await waitForOrdStockSync(Number(rpc('getblockcount').trim()));
  const inscriptionId = `${revealTxId}i0`;
  const { bytes: onChainBytes, contentType } = await getStockOrdContent(inscriptionId);
  expect(contentType).toBe('text/html;charset=utf-8');

  const onChainHtml = new TextDecoder().decode(onChainBytes);
  expect(onChainHtml).toBe(expectedCubeHtml);

  // Parser round-trip: parseCube must accept the on-chain bytes and
  // extract the same six side IDs as the "Side N" traits. This is
  // the same parser cubes.haushoppe.art uses to render the gallery.
  const parsed = parseRegtestCube(onChainHtml);
  expect(parsed).toBeTruthy();
  const parsedSides = parsed!
    .filter((t) => /^Side \d$/.test(t.trait_type))
    .sort((a, b) => a.trait_type.localeCompare(b.trait_type))
    .map((t) => t.value);
  expect(parsedSides).toEqual(CUBE_SIDE_IDS);

  // After the full mint arc is proven, fail the test if any console.error or
  // uncaught exception surfaced on an app page during the run, so a JS
  // regression in the mint flow is a regtest failure.
  errorGuard.assertClean();
});

/**
 * Reload the app and let the wallet reconnect. Xverse may ask to approve the
 * address request again, or reconnect silently; the header's connected button
 * exists only once the reconnect resolved, so it is the state that means no
 * popup is coming.
 */
async function reloadAndReconnect(cubes: Page): Promise<void> {
  const knownPagesBeforeReload = new Set(context.pages());
  await cubes.reload({ waitUntil: 'domcontentloaded' });
  const connectedBtn = cubes.locator('[data-testid="wallet-connected-btn"]');
  const reconnect = await raceApprovalPopup({
    context,
    knownPages: knownPagesBeforeReload,
    isApproval: xverseConnectApproval,
    noPopupState: connectedBtn,
  });
  if (reconnect.outcome === 'popup') await approveXverseConnect(reconnect.page, connectedBtn);
  await cubes.bringToFront();
  await expect(connectedBtn).toBeVisible();
}
