import { test, expect, chromium, Browser, Page } from '@playwright/test';

import { openDetails, RENDERABLE_SIDE_IDS, rpc } from '../regtest-helpers';

/**
 * PLACES the moment a suggestion lands, instead of racing it.
 *
 * CI caught a suggestion replacing side ids the spec had typed, on a page whose
 * `suggestionMayReplace` guard exists to forbid exactly that. Locally the
 * suggestion's data source is unreachable, so the window never opens and the
 * race cannot be reproduced by running the lane again.
 *
 * So the suggestion's fetches are HELD, the form is filled, and only then are
 * they released. That makes the landing moment a decision rather than a
 * coincidence.
 *
 * Both orderings this can place, after a settled fill and mid-fill, leave the
 * guard correctly refusing. So neither is the CI mechanism, and that is what
 * this spec is worth: it rules two candidates out and locks in the behaviour
 * for the orderings it does cover.
 */

const APP_URL = 'http://localhost:4203/';
const CUBES_INDEX = 'https://ordpool-space.github.io/**';

let browser: Browser;

test.beforeAll(async () => {
  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) throw new Error(`regtest tip is ${tip} (<101)`);
  browser = await chromium.launch();
});

test.afterAll(async () => {
  await browser?.close();
});

test('suggestion-repro: a suggestion landing after the fill must not replace typed sides', async () => {
  test.setTimeout(180_000);
  const page: Page = await browser.newPage();

  let release: (() => void) | undefined;
  const held = new Promise<void>((r) => { release = r; });
  let heldCount = 0;
  await page.route(CUBES_INDEX, async (route) => {
    heldCount += 1;
    await held;
    await route.continue();
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });

  await openDetails(page, 'configurator-advanced');
  // MID-FILL: release the suggestion after three sides, which is the ordering a
  // settled-fill repro cannot reach and the one a slow CI runner is most likely
  // to produce.
  for (let i = 0; i < 6; i++) {
    if (i === 3) release!();
    await page.locator(`[data-testid="cube-side-${i + 1}"]`).fill(RENDERABLE_SIDE_IDS[i]);
  }
  // Give the suggestion chain time to resolve and the effect time to run.
  await page.waitForTimeout(5_000);

  console.log(`[repro] held ${heldCount} index requests until after the fill`);

  // The claim under test: typed sides survive a late suggestion.
  for (let i = 0; i < 6; i++) {
    await expect(
      page.locator(`[data-testid="cube-side-${i + 1}"]`),
      `side ${i + 1} was replaced by a suggestion that landed after it was typed`,
    ).toHaveValue(RENDERABLE_SIDE_IDS[i]);
  }

  await page.close();
});
