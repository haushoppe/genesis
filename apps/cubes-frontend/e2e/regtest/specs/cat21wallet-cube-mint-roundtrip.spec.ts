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
import { closeLeftoverExtensionPages, onboardCat21Wallet, waitForApprovalPopup } from 'ordpool-sdk/e2e';

/**
 * Full user-flow proof for the CAT-21 wallet — cubes.haushoppe.art
 * end-to-end on regtest. Same shape as the Xverse spec, ported for
 * cat21-wallet's Leather-derived onboard + sign flow. Every
 * wallet-specific trick lifted verbatim from cat21-indexer's proven
 * `cat21wallet-mint-regtest.spec.ts`:
 *
 *   - Onboard from BIP-39 mnemonic (no cloned seed user-data-dir like
 *     Xverse): sign-in-link → 12 word inputs → password → dashboard.
 *   - CAT-21 wallet's SDK connector maps `Network.Regtest → 'regtest'`
 *     (the standard Bitcoin term — cat21-wallet also accepts Leather's
 *     legacy `'devnet'` alias for back-compat, but the SDK sends
 *     `'regtest'` per `toLeatherNetworkString` in `src/network.ts`),
 *     so `getAddresses` returns `bcrt1q…` / `bcrt1p…` directly. No
 *     regtest-derivation shim needed on the cubes side (Leather /
 *     other wallets are blocked on this until their connectors
 *     grow the same mapping — see WALLET-COMPATIBILITY.md).
 *   - Approval popups: `get-addresses-approve-button` testid
 *     (Leather-derived DOM). DO NOT `.close()` the popup after
 *     clicking — cat21-wallet's `userApprovesGetAddresses` runs a
 *     ~400 ms animation before the addresses actually dispatch back
 *     to the dapp; a manual close cuts the dispatch. Wait for the
 *     popup's own close event instead.
 *   - Sign-approval clicks use `{ noWaitAfter: true }` — cat21-wallet
 *     self-closes its sign popup the moment `signPsbt` reaches the
 *     service worker. Playwright's default click waits for post-
 *     click stability; that races against the popup teardown and
 *     surfaces as "Target page, context or browser has been closed".
 *     The close IS the success signal.
 *
 * If the mint-success assertion + on-chain byte-for-byte HTML check
 * both pass at the end, we've proved: user clicked → cat21-wallet
 * signed → chain accepted → ord indexed → the bytes on-chain are
 * exactly the cube the preview iframe rendered.
 */

const EXT_PATH = path.resolve(__dirname, '../extensions/cat21wallet');
const RESULTS_DIR = path.resolve(__dirname, '../../../test-results-regtest');
const CUBES_URL = 'http://localhost:4203/';

/** Same 0.002 BTC budget as the Xverse spec — comfortably covers
 *  commit + reveal fees + postage + tip at 5 sat/vB. */
const FUND_AMOUNT_BTC = 0.002;

/** Six valid-format inscription IDs; the ord cube-parser doesn't
 *  dereference `/content/<id>` while walking, so unresolvable IDs
 *  are fine as long as they pass `isValidInscriptionId`. */
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
    path: path.resolve(RESULTS_DIR, `cat21wallet-cube-mint-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
}

/**
 * Click the sign-approval button on a cat21-wallet popup with the
 * `noWaitAfter` race-avoidance from cat21-indexer's spec.
 */
async function clickCat21WalletApproval(popup: Page): Promise<void> {
  const btn = popup.getByRole('button', { name: /^(confirm|sign|approve)$/i }).first();
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.click({ noWaitAfter: true, timeout: 30_000 });
}

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(EXT_PATH, 'manifest.json'))) {
    throw new Error(
      `CAT-21 wallet extension not unpacked at ${EXT_PATH}. ` +
      `Run: bash e2e/regtest/playwright-bootstrap.sh cat21wallet`,
    );
  }

  // Sanity-check bitcoind reachable + coinbase-mature tip.
  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) {
    throw new Error(
      `regtest tip is ${tip} (<101). ` +
      `Run: bash e2e/regtest/regtest-bootstrap.sh`,
    );
  }

  // Fresh per-run user-data-dir (no seed; the mnemonic onboarding
  // in beforeAll does the work). Strip singleton locks in case a
  // previous suite left a partial dir behind.
  const workingDir = path.resolve(RESULTS_DIR, `cat21wallet-user-data-dir-${process.pid}-${Date.now()}`);
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

  // Onboard once for the whole suite (only one test today; sets the
  // shape for future tests to inherit the connected wallet).
  const primer = await context.newPage();
  await onboardCat21Wallet(primer, extensionId);
  await shot(primer, '00-onboarded');
  await primer.close();
});

test.afterAll(async () => {
  await context?.close();
});

test('mint a cube via CAT-21 wallet: fill form → sign in wallet → broadcast → ord indexes the HTML byte-for-byte', async () => {
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
    console.log(`[cat21wallet-mint console.error] ${text}`);
    if (!IGNORED_CONSOLE.some((re) => re.test(text))) {
      browserErrors.push(`console.error: ${text}`);
    }
  });
  cubes.on('pageerror', (err) => {
    console.log(`[cat21wallet-mint pageerror] ${err.message}`);
    browserErrors.push(`pageerror: ${err.message}`);
  });

  // Stub /api/v1/fees/recommended — regtest has no ordpool-backend,
  // so this endpoint would 404 without the stub. Deterministic
  // fixed values for the fee-tier button assertions.
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

  // Fill six sides via the Customize details.
  await openDetails(cubes, 'configurator-advanced');
  for (let i = 0; i < 6; i++) {
    await cubes.locator(`[data-testid="cube-side-${i + 1}"]`).fill(CUBE_SIDE_IDS[i]);
  }
  await shot(cubes, '02a-form-filled');

  // Click mint-cta — triggers the top-right wallet-connect widget when
  // no wallet is connected yet.
  const mintCta = cubes.locator('[data-testid="mint-cta"]');
  await expect(mintCta).toBeEnabled({ timeout: 10_000 });
  await mintCta.click();

  // Wallet picker opens.
  await expect(cubes.locator('[data-testid="wallet-picker-detected"]')).toBeVisible({ timeout: 10_000 });
  const connectLink = cubes.locator('[data-testid="wallet-connect-cat21wallet"]');
  await expect(connectLink).toBeVisible({ timeout: 10_000 });
  await shot(cubes, '02b-wallet-picker-open');

  // Snapshot pages BEFORE the connect click so waitForApprovalPopup
  // doesn't false-positive on an already-open extension page.
  const knownPagesBeforeConnect = new Set(context.pages());
  await connectLink.click();

  const connectPopup = await waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeConnect,
    timeoutMs: 60_000,
    isApproval: async (p) => {
      if (!p.url().startsWith('chrome-extension://')) return false;
      await p.getByTestId('get-addresses-approve-button')
        .waitFor({ state: 'visible', timeout: 60_000 });
      return true;
    },
  });
  await shot(connectPopup, '03a-connect-popup');
  await connectPopup.getByTestId('get-addresses-approve-button').click();
  // Do NOT explicitly .close() — cat21-wallet's userApprovesGetAddresses
  // runs a ~400 ms animation before dispatching addresses. Manual close
  // cuts the dispatch. Wait for the popup's own close instead.
  await connectPopup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await cubes.bringToFront();

  await expect(cubes.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 45_000 });

  // Extract the regtest payment address from the header popover — the
  // full-address element, not the shortened wallet-connected label.
  await cubes.locator('[data-testid="wallet-connected-btn"]').click();
  const paymentAddrLoc = cubes.locator('[data-testid="wallet-popover-payment-address"]');
  await expect(paymentAddrLoc).toBeVisible({ timeout: 15_000 });
  const paymentAddr = ((await paymentAddrLoc.getAttribute('title')) ?? (await paymentAddrLoc.textContent()) ?? '').trim();
  expect(paymentAddr).toMatch(/^bcrt1q/);
  console.log(`[cat21wallet-mint] payment address: ${paymentAddr}`);
  // Close the popover.
  await cubes.locator('[data-testid="wallet-connected-btn"]').click();

  // Fund + mine + electrs-sync.
  rpc('-rpcwallet=cubes-e2e', 'sendtoaddress', paymentAddr, String(FUND_AMOUNT_BTC));
  await waitForElectrsSync(mineBlocks(1));
  await waitForUtxoAt(paymentAddr, Math.round(FUND_AMOUNT_BTC * 1e8));

  // Reload so the orchestrator's utxos$ chain re-fires against the
  // now-funded address (same reason as Xverse spec).
  await cubes.reload({ waitUntil: 'domcontentloaded' });

  // On reload, the picker will re-prompt for connection approval.
  // Approve it if it appears.
  const knownPagesBeforeReconnect = new Set(context.pages());
  const reapprovePromise = waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeReconnect,
    timeoutMs: 15_000,
    isApproval: async (p) => {
      if (!p.url().startsWith('chrome-extension://')) return false;
      await p.getByTestId('get-addresses-approve-button')
        .waitFor({ state: 'visible', timeout: 15_000 });
      return true;
    },
  }).catch(() => null);
  const reapprove = await reapprovePromise;
  if (reapprove) {
    await reapprove.getByTestId('get-addresses-approve-button').click();
    await reapprove.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  }
  await cubes.bringToFront();
  // Post-reload the mint drawer is closed, so [data-testid="wallet-connected"]
  // (which lives INSIDE the drawer's connected-wallet block, start.html:121)
  // isn't rendered yet. Use the always-visible header button as the
  // reconnected-state gate; the drawer's own testid gets re-asserted
  // after we click mint-cta below.
  await expect(cubes.locator('[data-testid="wallet-connected-btn"]')).toBeVisible({ timeout: 45_000 });

  // Re-fill the six sides — form state doesn't survive reload.
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

  // Compute the exact HTML the preview will produce so the on-chain
  // check is byte-for-byte.
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

  // Wait for mint-btn to unlock (canMint = true after simulations$).
  const mintBtn = cubes.locator('[data-testid="mint-btn"]');
  await expect(mintBtn).toBeEnabled({ timeout: 60_000 });

  await closeLeftoverExtensionPages(context, [cubes]);
  const knownPagesBeforeSign = new Set(context.pages());
  await mintBtn.click();

  // Check for a synchronous mint-error (rule §11 escape hatch).
  const errLocator = cubes.locator('[data-testid="mint-error-message"]');
  await errLocator.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  if (await errLocator.isVisible()) {
    const postMintErr = (await errLocator.textContent())?.trim() ?? '';
    if (postMintErr && !postMintErr.includes('cancel')) {
      throw new Error(`orchestrator.mint() reported an error before the sign popup opened: ${postMintErr}`);
    }
  }

  // Sign popup: cat21-wallet lands on a Confirm-flavoured button; use
  // the shared clickCat21WalletApproval helper (noWaitAfter trick).
  const signPopup = await waitForApprovalPopup({
    context,
    knownPages: knownPagesBeforeSign,
    timeoutMs: 120_000,
    isApproval: async (p) => {
      if (!p.url().startsWith('chrome-extension://')) return false;
      await p.getByRole('button', { name: /^(confirm|sign|approve)$/i }).first()
        .waitFor({ state: 'visible', timeout: 60_000 });
      return true;
    },
  });
  await shot(signPopup, '05a-sign-popup');
  await clickCat21WalletApproval(signPopup);
  console.log('[cat21wallet-mint] sign approved; waiting for mint-success');

  await expect(cubes.locator('[data-testid="mint-success"]')).toBeVisible({ timeout: 120_000 });
  await expect(cubes.locator('[data-testid="mint-btn"]')).toHaveAttribute('aria-busy', 'false');
  await shot(cubes, '06-success');

  const commitTxId = (await cubes.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
  const revealTxId = (await cubes.locator('[data-testid="mint-reveal-txid"]').getAttribute('aria-label'))?.trim() ?? '';
  expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);
  expect(revealTxId).toMatch(/^[0-9a-f]{64}$/);
  console.log(`[cat21wallet-mint] commit=${commitTxId.slice(0, 12)}… reveal=${revealTxId.slice(0, 12)}…`);

  // Mine + wait for both txs to confirm.
  await waitForElectrsSync(mineBlocks(1));
  await waitForTxConfirmed(commitTxId);
  await waitForElectrsSync(mineBlocks(1));
  const revealTx = await waitForTxConfirmed(revealTxId);
  expect(revealTx.status.block_hash).toBeTruthy();

  // Wait for ord-stock to catch up and verify byte-equal HTML.
  await waitForOrdStockSync(Number(rpc('getblockcount').trim()));
  const inscriptionId = `${revealTxId}i0`;
  const { bytes: onChainBytes, contentType } = await getStockOrdContent(inscriptionId);
  expect(contentType).toBe('text/html;charset=utf-8');

  const onChainHtml = new TextDecoder().decode(onChainBytes);
  expect(onChainHtml).toBe(expectedCubeHtml);

  // Parser round-trip: extract the six side IDs from the on-chain
  // bytes and confirm they match what the form was filled with.
  const parsed = parseCube(onChainHtml);
  expect(parsed).toBeTruthy();
  const parsedSides = parsed!
    .filter((t) => /^Side \d$/.test(t.trait_type))
    .sort((a, b) => a.trait_type.localeCompare(b.trait_type))
    .map((t) => t.value);
  expect(parsedSides).toEqual(CUBE_SIDE_IDS);

  // Rule §11: fail if any unfiltered browser error surfaced.
  if (browserErrors.length) {
    throw new Error(
      `Test passed the mint arc but ${browserErrors.length} unfiltered browser error(s) surfaced:\n  - ${browserErrors.join('\n  - ')}`,
    );
  }
});
