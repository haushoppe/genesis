/* eslint-disable no-console */
import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { getCubeHtml } from '../../../src/app/services/cube-html';
import { parseCube } from '../../../src/shared/ordinals/parse-cube';
import {
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
  fillCubeSides,
  trackRequestFailures,
  openDetails,
  RENDERABLE_SIDE_IDS,
  NON_IMAGE_SIDE_ID,
} from '../regtest-helpers';
import { closeLeftoverExtensionPages, onboardUnisat, waitForApprovalPopup } from 'ordpool-sdk/e2e';
import { recommendedFeesFixture } from 'ordpool-sdk';

/**
 * Poll the real ordpool-backend for an inscription's rendered bytes. It
 * decodes the inscription from the parent tx's witness over bitcoind RPC and
 * reads the mempool first, so this returns for an UNCONFIRMED tx. A short
 * retry covers the moment between broadcast and bitcoind holding the tx.
 */
async function pollForOrdpoolContent(url: string): Promise<string> {
  let lastStatus = 'no response';
  for (let i = 0; i < 30; i++) {
    const res = await fetch(url).catch(() => null);
    if (res?.ok) return res.text();
    lastStatus = res ? `HTTP ${res.status}` : 'no response';
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`ordpool-backend did not render ${url} within 30s (last: ${lastStatus})`);
}

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

const FUND_AMOUNT_BTC = 0.002;

const CUBE_SIDE_IDS = RENDERABLE_SIDE_IDS;

let context: BrowserContext;
let extensionId: string;

async function shot(p: Page, name: string): Promise<void> {
  await p.screenshot({
    path: path.resolve(RESULTS_DIR, `unisat-cube-mint-${name}.png`),
    fullPage: true,
  }).catch(() => undefined);
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
  await onboardUnisat(primer, extensionId, { password: 'correct-horse-battery-staple-Tr0ub4dor-9876' });
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
  // Console noise is judged by the failing resource, not by status class:
  cubes.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    console.log(`[unisat-mint console.error] ${text}`);
    {
      browserErrors.push(`console.error: ${text}`);
    }
  });
  const requestFailures = trackRequestFailures(cubes);
  cubes.on('pageerror', (err) => {
    console.log(`[unisat-mint pageerror] ${err.message}`);
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

  const mintCta = cubes.locator('[data-testid="mint-cta"]');
  await expect(mintCta).toBeEnabled({ timeout: 10_000 });

  // The black-face check: a side that is JSON on chain loads with 200 but
  // never decodes as an image; the form names the face and keeps Mint off
  // until the side is replaced.
  await cubes.locator('[data-testid="cube-side-2"]').fill(NON_IMAGE_SIDE_ID);
  await expect(cubes.locator('[data-testid="mint-black-faces"]')).toContainText('Side 2 does not render as an image', { timeout: 10_000 });
  await expect(mintCta).toBeDisabled();
  await cubes.locator('[data-testid="cube-side-2"]').fill(CUBE_SIDE_IDS[1]);
  await expect(cubes.locator('[data-testid="mint-black-faces"]')).toHaveCount(0, { timeout: 10_000 });
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

  const paymentAddr = await readWalletPopoverAddress(cubes, 'wallet-popover-payment-address');
  // Unisat's default address type is BIP-84 P2WPKH (bc1q…); SDK shim
  // rewrites to bcrt1q. Users who selected other address types would
  // see bcrt-2… (Nested SegWit) or bcrt1p… (Taproot); address-type
  // matrix coverage is a follow-up.
  expect(paymentAddr).toMatch(/^bcrt1[qp]|^2/);
  console.log(`[unisat-mint] payment address: ${paymentAddr}`);
  await cubes.locator('[data-testid="wallet-connected-btn"]').click();

  await fundCommonSats(paymentAddr, FUND_AMOUNT_BTC);

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

  const inscriptionId = `${revealTxId}i0`;

  // --- PROOF: the cube renders from the MEMPOOL, before any block is mined ---
  // The real ordpool-backend (:8999) decodes the inscription from the still-
  // unconfirmed reveal tx's witness — the whole anti-waiting feature. Its bytes
  // must equal exactly what we minted, and the success panel must reflect it.
  const mempoolHtml = await pollForOrdpoolContent(`http://localhost:8999/content/${inscriptionId}`);
  expect(mempoolHtml).toBe(expectedCubeHtml);
  await expect(cubes.locator('[data-testid="mint-status-badge"]')).toContainText(/mempool/i, { timeout: 30_000 });
  // The success preview shows the cube's bytes as srcdoc (dark canvas from the
  // first frame), fetched from the ordpool-backend's /content. The minted body
  // must land in the iframe byte-for-byte, wrapped only with the display-only
  // dark meta and a base at the :8999 ord root.
  const preview = cubes.locator('[data-testid="mint-success-preview"]');
  // Waits for the BASE, not for the dark meta. The placeholder document this
  // iframe shows before the bytes arrive carries that same meta by design
  // (cube-srcdoc.ts paints the stage from the first frame), so waiting on it
  // is satisfied by the placeholder and the read below then samples the
  // placeholder instead of the cube. That is not a timing accident: it is a
  // wait whose condition the intermediate state also meets, and it failed
  // whenever the fetch had not landed within the same beat.
  // The iframe loads its bytes on INTERSECTION (ToggleIframeDirective), so an
  // off-screen preview holds the placeholder indefinitely and no wait can
  // rescue it. Scrolling it in is part of the scenario, not a workaround.
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('srcdoc', /<base href="http:\/\/[^"]+:8999\/">/, { timeout: 30_000 });
  const previewSrcdoc = (await preview.getAttribute('srcdoc')) ?? '';
  expect(previewSrcdoc).toMatch(/<base href="http:\/\/[^"]+:8999\/">/);
  expect(previewSrcdoc.endsWith(expectedCubeHtml.slice(expectedCubeHtml.indexOf('<body>')))).toBe(true);
  console.log('[unisat-mint] ordpool-backend rendered the cube from the mempool (pre-confirmation) ✓');

  await waitForElectrsSync(mineBlocks(1));
  const commitTx = await waitForTxConfirmed(commitTxId);
  await waitForElectrsSync(mineBlocks(1));
  const revealTx = await waitForTxConfirmed(revealTxId);
  expectTipPaid(commitTx, revealTx);
  expect(revealTx.status.block_hash).toBeTruthy();

  // --- PROOF: once mined, the status badge flips to "confirmed" ---
  await expect(cubes.locator('[data-testid="mint-status-badge"]')).toContainText(/confirmed/i, { timeout: 30_000 });
  console.log('[unisat-mint] status badge flipped to confirmed after mining ✓');

  await waitForOrdStockSync(Number(rpc('getblockcount').trim()));
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
