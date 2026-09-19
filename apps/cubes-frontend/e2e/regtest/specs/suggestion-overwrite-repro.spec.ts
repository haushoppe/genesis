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
 * THREE orderings have been placed and all three leave the guard correctly
 * refusing: after a settled fill, mid-fill released at the fourth side, and an
 * earliest-possible fill that does not wait for the page to settle (navigating
 * with `waitUntil: 'commit'` and typing as soon as the inputs exist). None is
 * the CI mechanism.
 *
 * The earliest-fill variant is not kept, because Playwright's actionability
 * wait means `fill` does not type into a form that is not ready anyway, so it
 * reaches no earlier than this and only makes the spec more fragile. What this
 * spec is worth is ruling three candidates out and locking in the behaviour for
 * the orderings it covers.
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

/**
 * PLACES the suggestion at the blank-to-first-fill boundary, which is the one
 * region the three orderings above never touched.
 *
 * Those three all released the suggestion onto a form that was ALREADY
 * non-blank, so `suggestionMayReplace` correctly refused, no whole-form write
 * happened, and nothing re-rendered. They therefore rule out a guard defect,
 * and say nothing at all about the mechanism CI actually shows.
 *
 * The measured baseline (23 occurrences in one green matrix run) is that the
 * suggestion normally lands on the still-blank form BEFORE a spec types, which
 * is allowed, writes all six fields, and re-renders all six controls. A fill
 * landing inside that re-render does not stick. That is the same shape as a
 * click landing while a popover re-renders, and it needs no writer: the value
 * is simply never committed.
 *
 * So the release is placed across a SWEEP of offsets around the first fill
 * rather than at one guessed instant. Each pass reloads, re-holds the index
 * fetches, releases, waits its offset, then types. If a fill is lost, the
 * assertion below fails and names the offset, which turns the correlation the
 * `fillCubeSides` log reports into a placement that can be repeated.
 *
 * It asserts the CORRECT behaviour on purpose, so it can go red. A red here is
 * the reproduction, not a flake to soften.
 *
 * The offsets are a search range, not a measured constant: the point is to
 * cover the window, and any one of them landing is the finding.
 *
 * WHAT A LOCAL GREEN MEANS HERE, precisely: the index fetches ARE issued from
 * a dev machine (this spec counts six of them), but no suggestion was observed
 * to land in any local run, measured as the not-yet-typed sides being blank at
 * every check. With no whole-form write there is no re-render and the sweep
 * exercises nothing, so a local pass is a statement about the machinery and
 * not about the placement. The assertion is mutation-checked separately: a
 * clobber injected before the read fails the pass and names the offset.
 */
const RELEASE_OFFSETS_MS = [0, 50, 100, 150, 200, 300, 400, 600, 900];

test('suggestion-repro: a suggestion landing across the first fill must not drop it', async () => {
  test.setTimeout(300_000);

  for (const offset of RELEASE_OFFSETS_MS) {
    const page: Page = await browser.newPage();
    let release: (() => void) | undefined;
    const held = new Promise<void>((r) => { release = r; });
    await page.route(CUBES_INDEX, async (route) => {
      await held;
      await route.continue();
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });
    await openDetails(page, 'configurator-advanced');

    // Release, wait the offset, then type. The suggestion's chain resolves
    // while the typing happens, which is the window under test.
    release!();
    await page.waitForTimeout(offset);
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="cube-side-${i + 1}"]`).fill(RENDERABLE_SIDE_IDS[i]);
    }

    const values = await Promise.all(RENDERABLE_SIDE_IDS.map((_, i) =>
      page.locator(`[data-testid="cube-side-${i + 1}"]`).inputValue()));
    const lost = values
      .map((v, i) => ({ i, v }))
      .filter(({ i, v }) => v !== RENDERABLE_SIDE_IDS[i]);
    if (lost.length > 0) {
      for (const { i, v } of lost) {
        console.log(`[repro +${offset}ms] side ${i + 1} holds "${v}", typed "${RENDERABLE_SIDE_IDS[i]}"`);
      }
    }
    await page.close();

    expect(
      lost.map(({ i }) => i + 1),
      `release +${offset}ms after the form was ready: these sides did not keep the typed value`,
    ).toEqual([]);
  }
});

