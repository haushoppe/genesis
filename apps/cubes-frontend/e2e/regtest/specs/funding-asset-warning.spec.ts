import { test, expect, chromium, Browser, Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
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
import { seedDirtyCoin, type DirtyCoinAsset } from 'ordpool-sdk/e2e';

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

/**
 * All four classes, which watch-only makes safe to loop: it derives a FRESH
 * account per case, so no case inherits the previous one's coin. The sibling
 * notice spec cannot do this, because Leather's seed is fixed and its address
 * accumulates across runs.
 */
const ASSETS: DirtyCoinAsset[] = ['inscription', 'cat', 'rune', 'rareSat'];


/**
 * Documentation screenshots live OUTSIDE Playwright's outputDir, which is
 * cleared at the start of every run: a picture written there is gone the moment
 * anyone runs another spec, which is not what "the screenshot exists" should
 * mean. Gitignored; regenerate by running this lane.
 */
const STATE_SHOTS = path.resolve(__dirname, '../.state-screenshots');

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

for (const asset of ASSETS) {
  test(`funding-warning: a one-address wallet whose only coin carries ${asset} is BLOCKED and told why`, async () => {
  test.setTimeout(240_000);

  const master = HDKey.fromMasterSeed(randomBytes(32), TESTNET_VERSIONS);
  const account = master.derive(ACCOUNT_PATH);
  const leaf = account.derive('m/0/0');
  const address = btc.p2tr(leaf.publicKey!.slice(1, 33), undefined, REGTEST).address!;

  // The ONLY coin. No clean coin anywhere, which is what forces the decision.
  const dirty = await seedDirtyCoin({ asset, address, valueSats: DIRTY_SATS });
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

  await expect(page.locator('[data-testid="mint-cta"]')).toBeEnabled({ timeout: 60_000 });
  await page.locator('[data-testid="mint-cta"]').click();

  await expect(page.locator('[data-testid="mint-checkout"]')).toBeVisible({ timeout: 30_000 });

  // The warning, not the notice: this wallet cannot separate the two lanes.
  const emits = await page.evaluate(() => {
    const w = window as unknown as { __walletEmits?: number; __walletRefs?: unknown[] };
    const refs = w.__walletRefs ?? [];
    const distinct = new Set(refs).size;
    return { emissions: w.__walletEmits ?? 0, distinctRefs: distinct };
  });
  console.log('[wallet-emit]', JSON.stringify(emits));

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
  if (asset === 'inscription') {
    fs.mkdirSync(STATE_SHOTS, { recursive: true });
    await shot.screenshot({ path: path.resolve(STATE_SHOTS, 'funding-warning-one-address.png') });
  }

  // Names the SPECIFIC asset, which is the difference between a warning and a
  // useful one. Asserting that "a warning appeared" would pass against a panel
  // describing a different coin, which is exactly the two-source failure the
  // SDK removed by putting the assets on the recommendation.
  // What identifies a coin's contents differs BY CLASS, so assert what that
  // class actually shows rather than forcing one shape on all four.
  //
  // A cat is the documented exception: `catIds` are inscription-id hex, not the
  // cat NUMBER a holder knows, so the row shows the count and links to the sat
  // page, which names and shows every cat on that sat. Asserting the raw id
  // here would demand a row of opaque hex and argue against a decision that was
  // made deliberately and is written down in funding-asset-rows.ts. This spec
  // caught that difference by failing on it, which is the assertion working.
  const picker = page.locator('[data-testid="mint-expert-details"]');
  if (asset === 'cat') {
    await expect(picker).toContainText(/CAT-21 cat/);
    await expect(picker.locator('a[href*="/sat/"]')).toHaveCount(1);
  } else if (asset === 'rune') {
    await expect(picker).toContainText(dirty.assetId);
  } else if (asset === 'rareSat') {
    await expect(picker).toContainText(/rare sat:/);
    await expect(picker).toContainText(dirty.assetId);
  } else {
    await expect(picker).toContainText(dirty.assetId);
  }

  // THE FEE COLUMN. Per-coin cost is a consequence of picking that coin exactly
  // as its assets are, so it belongs on the row. The qualifier is not decoration
  // here: a cube is commit + reveal, and the same figure on a mint surface is
  // one transaction, so the word is what stops a reader comparing two different
  // things across two sites.
  if (asset === 'inscription') {
    const fee = page.locator('[data-testid="mint-row-fee"]').first();
    await expect(fee).toBeVisible();
    await expect(fee).toContainText('(commit + reveal)');
    // The family money shape: space-grouped sats. The fiat half is absent when
    // no rate is known, and must never appear as 0 or a dash.
    await expect(fee).toContainText(/\d[\d\u202f\u00a0 ]* sat/);
    await expect(fee).not.toContainText(/~\$0\b|~\$-|\(\s*-\s*\)/);
  }

  // The EXPERT state: the reader overrides the block by picking the coin the
  // guard refused. Asserted, not just photographed: after the explicit pick the
  // CTA must become usable, or "Use anyway" is a button that does nothing.
  if (asset === 'inscription') {
    await page.locator('[data-testid="mint-expert-details"]').getByRole('button', { name: /use anyway/i }).first().click();
    await expect(page.locator('[data-testid="mint-btn"]')).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator('[data-testid="mint-checkout"]')).toContainText(/You picked this funding coin/i);
    fs.mkdirSync(STATE_SHOTS, { recursive: true });
    await page.locator('[data-testid="mint-checkout"]').screenshot({
      path: path.resolve(STATE_SHOTS, 'funding-expert-picked.png'),
    });
  }

  if (asset === 'inscription') {
    const contrast = await page.evaluate(() => {
      // A measurement is code and can be wrong in the same shape as the thing
      // it measures. This one reads colours as OPAQUE: given rgba() it would
      // ignore the alpha and compute a confident ratio for a colour nobody
      // sees. Rather than composite (which needs the full stack and is its own
      // source of error), refuse to answer, so a translucent layer surfaces as
      // an explicit gap instead of a number that looks fine.
      const lum = (c: string) => {
        const m = c.match(/\d+(\.\d+)?/g)!.map(Number);
        if (m.length > 3 && m[3] < 1) throw new Error(`translucent colour ${c}: this measurement assumes opaque`);
        const [r, g, b] = m.slice(0, 3).map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const groundOf = (el: Element): string => {
        let n: Element | null = el;
        while (n) {
          const bg = getComputedStyle(n).backgroundColor;
          if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
          n = n.parentElement;
        }
        return 'rgb(255,255,255)';
      };
      const out: Record<string, unknown> = {};
      for (const [k, sel] of [['badge', '[data-testid="mint-expert-details"] .badge'],
                              ['useAnyway', '[data-testid="mint-expert-details"] button']] as const) {
        const el = document.querySelector(sel);
        if (!el) { out[k] = 'ABSENT'; continue; }
        const cs = getComputedStyle(el);
        const fg = cs.color;
        const bg = /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) ? groundOf(el.parentElement!) : cs.backgroundColor;
        const l1 = lum(fg), l2 = lum(bg);
        out[k] = { text: (el as HTMLElement).innerText.trim().slice(0, 20), fg, bg,
                   ratio: Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)) };
      }
      return out;
    });
    // WCAG AA: 4.5:1 for normal text. Asserted, not logged, because the
    // failure mode is a pairing rather than a value: every colour involved is
    // individually valid and only the combination fails, so it survives being
    // looked at. Measured before the fix: the badge read 3.48:1 and "Use
    // anyway" 2.94:1 on this panel's dark ground, and "Use anyway" is the one
    // control that spends an asset-bearing coin.
    for (const [key, m] of Object.entries(contrast as Record<string, { text: string; fg: string; bg: string; ratio: number }>)) {
      expect(
        m.ratio,
        `${key} ("${m.text}") renders ${m.fg} on ${m.bg} at ${m.ratio}:1, under the 4.5:1 AA floor`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  }

  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  await page.close();
  });
}
