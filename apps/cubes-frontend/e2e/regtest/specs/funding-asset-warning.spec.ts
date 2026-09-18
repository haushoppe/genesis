import { test, expect, chromium, Browser, Page } from '@playwright/test';
import { HDKey } from '@scure/bip32';
import * as btc from '@scure/btc-signer';
import { randomBytes } from '@noble/hashes/utils';

import {
  isExpectedConsoleError,
  mineBlocks,
  openDetails,
  RENDERABLE_SIDE_IDS,
  rpc,
  waitForElectrsSync,
} from '../regtest-helpers';
import { seedDirtyCoin } from 'ordpool-sdk/e2e';

/**
 * What the reader is TOLD when the only coin that can fund the mint carries
 * something they would lose by spending it.
 *
 * Every other spec here funds with a clean coin, so the guard resolves to
 * `auto` and says nothing, which is the correct silent default and proves
 * nothing about this path. Here the wallet holds a dirty coin and NOTHING
 * ELSE, so the guard has to choose between informing and blocking.
 *
 * Watch-only derives one address and uses it for both payment and ordinals, so
 * `isOneAddressWallet` is true and this is the BLOCKING case: assets and
 * spending money share a lane, an accidental spend is easy and invisible, and
 * the CTA must stay disabled until the reader picks a coin explicitly.
 *
 * The notice case (a wallet with a separate payment address, informed and
 * allowed to proceed) needs an extension wallet and lives with those specs.
 */

const REGTEST = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };
const TESTNET_VERSIONS = { private: 0x04358394, public: 0x043587cf };
const ACCOUNT_PATH = "m/86'/1'/0'";
const APP_URL = 'http://localhost:4203/';
const CUBE_SIDE_IDS = RENDERABLE_SIDE_IDS;

/** Covers the ~6 300-sat requirement many times over, so nothing here turns on size. */
const DIRTY_SATS = 300_000;

let browser: Browser;

test.beforeAll(async () => {
  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) {
    throw new Error(`regtest tip is ${tip} (<101). Run: bash e2e/regtest/regtest-bootstrap.sh`);
  }
  browser = await chromium.launch();
});

test.afterAll(async () => {
  await browser?.close();
});

test('funding-warning: a one-address wallet whose only coin carries an inscription is BLOCKED and told why', async () => {
  test.setTimeout(240_000);

  const master = HDKey.fromMasterSeed(randomBytes(32), TESTNET_VERSIONS);
  const account = master.derive(ACCOUNT_PATH);
  const leaf = account.derive('m/0/0');
  const address = btc.p2tr(leaf.publicKey!.slice(1, 33), undefined, REGTEST).address!;

  // The ONLY coin. No clean coin anywhere, which is what forces the decision.
  const dirty = await seedDirtyCoin({ asset: 'inscription', address, valueSats: DIRTY_SATS });
  await waitForElectrsSync(mineBlocks(1));

  const page: Page = await browser.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !isExpectedConsoleError(m.text(), m.location().url)) {
      errors.push(m.text());
    }
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });

  await page.locator('[data-testid="wallet-connect-btn"]').click();
  await expect(page.locator('[data-testid="wallet-picker-list"]')).toBeVisible({ timeout: 10_000 });
  await page.locator('[data-testid="wallet-connect-xpub"]').click();
  await expect(page.locator('[data-testid="wallet-xpub-form"]')).toBeVisible();
  await page.locator('[data-testid="wallet-xpub-input"]').fill(account.publicExtendedKey);
  await page.locator('[data-testid="wallet-xpub-connect"]').click();
  const scriptType = page.locator('[data-testid="wallet-xpub-script-type"]');
  await scriptType.waitFor({ state: 'visible', timeout: 15_000 });
  await scriptType.selectOption('p2tr');
  await page.locator('[data-testid="wallet-xpub-connect"]').click();
  await expect(page.locator('[data-testid="wallet-connected-address"]')).toBeVisible({ timeout: 30_000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });
  await openDetails(page, 'configurator-advanced');
  for (let i = 0; i < 6; i++) {
    await page.locator(`[data-testid="cube-side-${i + 1}"]`).fill(CUBE_SIDE_IDS[i]);
  }

  await expect(page.locator('[data-testid="mint-cta"]')).toBeEnabled({ timeout: 30_000 });
  await page.locator('[data-testid="mint-cta"]').click();

  await expect(page.locator('[data-testid="mint-checkout"]')).toBeVisible({ timeout: 30_000 });

  // The warning, not the notice: this wallet cannot separate the two lanes.
  const warning = page.locator('[data-testid="mint-expert-required"]');
  await expect(warning).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-testid="mint-asset-notice"]')).toHaveCount(0);

  // BLOCKED. The whole point: an asset-bearing coin is never spent by default.
  await expect(page.locator('[data-testid="mint-btn"]')).toBeDisabled();

  // The picker opens itself and offers the coin, so the block is a decision the
  // reader can make rather than a dead end.
  await expect(page.locator('[data-testid="mint-expert-details"]')).toHaveAttribute('open', '');

  // Framed so the WARNING and the DISABLED button are in one viewport. A
  // screenshot of the right page scrolled to the wrong place documents nothing,
  // and if the two cannot be seen together that is a finding about the layout
  // rather than about the framing.
  await warning.scrollIntoViewIfNeeded();
  const shot = page.locator('[data-testid="mint-checkout"]');
  await shot.screenshot({ path: 'test-results-regtest/funding-warning-one-address.png' });

  // Names the SPECIFIC asset, which is the difference between a warning and a
  // useful one. Asserting that "a warning appeared" would pass against a panel
  // describing a different coin, which is exactly the two-source failure the
  // SDK removed by putting the assets on the recommendation.
  await expect(page.locator('[data-testid="mint-expert-details"]')).toContainText(dirty.assetId);

  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  await page.close();
});
