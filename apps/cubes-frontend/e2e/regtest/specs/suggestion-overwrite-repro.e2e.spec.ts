/**
 * @test-kind e2e
 * Real:   cubes app on the Angular dev server (ng serve -c regtest), regtest stack (bitcoind
 *         30, ordpool-electrs, cat21-ord, stock ord, ordpool-backend)
 * Faked:  nothing
 * Proves: side ids typed over the boot-time suggestion keep their values. It does NOT place
 *         the suggestion: on regtest the suggestion has no network step (stand-in galleries
 *         from the environment), so there is no request to hold and it has filled all six
 *         sides before the first fill. Any console.error or uncaught exception on the page
 *         fails it
 */
import { test, expect, chromium, Browser, Page } from '@playwright/test';

import {
  installContextErrorGuard, netLogArgs, offlineLaunchArgs, reachableHosts, rpc, workaroundWaitForTimeout,
} from 'ordpool-sdk/e2e';
import { CUBES_URL, openDetails, RENDERABLE_SIDE_IDS } from '../regtest-helpers';

/**
 * Typed side ids must survive the boot-time suggestion.
 *
 * CI caught a suggestion replacing side ids the spec had typed, on a page whose
 * `suggestionMayReplace` guard exists to forbid exactly that. On mainnet the
 * suggestion's data comes from the network and could be held to place its
 * landing; on regtest it comes from the environment's stand-in galleries, with
 * no request to hold, so these specs lock in the behaviour for the orderings
 * they can reach rather than placing the write.
 */

let browser: Browser;

test.beforeAll(async () => {
  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) throw new Error(`regtest tip is ${tip} (<101)`);
  // No wallet extension, so no launchWalletContext, but the same switches it
  // passes: nothing but loopback and the regtest stack resolves, and with
  // ORDPOOL_E2E_NET_LOG_DIR set the net log records what the browser sent.
  browser = await chromium.launch({ args: [...offlineLaunchArgs(reachableHosts()), ...netLogArgs('suggestion-repro')] });
});

test.afterAll(async () => {
  await browser?.close();
});

test('suggestion-repro: a suggestion landing after the fill must not replace typed sides', async () => {
  const context = await browser.newContext();
  // Fails the test on any console.error or uncaught exception from a page of this context.
  const errorGuard = installContextErrorGuard(context);
  const page: Page = await context.newPage();

  await page.goto(CUBES_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="page-title"]')).toBeVisible();

  await openDetails(page, 'configurator-advanced');
  for (let i = 0; i < 6; i++) {
    await page.locator(`[data-testid="cube-side-${i + 1}"]`).fill(RENDERABLE_SIDE_IDS[i]);
  }
  // The suggestion effect exposes no "landed" state, so a late write can only
  // be given time; the values are read after it, not right after the fill.
  await workaroundWaitForTimeout(
    page,
    5_000,
    'a late suggestion write after the fill; the suggestion effect exposes no landed state',
  );

  // The claim under test: typed sides survive a late suggestion.
  for (let i = 0; i < 6; i++) {
    await expect(
      page.locator(`[data-testid="cube-side-${i + 1}"]`),
      `side ${i + 1} was replaced by a suggestion that landed after it was typed`,
    ).toHaveValue(RENDERABLE_SIDE_IDS[i]);
  }

  errorGuard.assertClean();
  await context.close();
});

/**
 * Sweeps the first fill across the blank-to-first-fill boundary.
 *
 * The measured baseline (23 occurrences in one green matrix run) is that the
 * suggestion normally lands on the still-blank form BEFORE a spec types, which
 * is allowed, writes all six fields, and re-renders all six controls. A fill
 * landing inside that re-render does not stick. That is the same shape as a
 * click landing while a popover re-renders, and it needs no writer: the value
 * is simply never committed.
 *
 * So the first fill is placed across a SWEEP of offsets after the form is
 * ready rather than at one guessed instant. Each pass loads the page fresh,
 * waits its offset, then types. If a fill is lost, the
 * assertion below fails and names the offset, which turns the correlation the
 * `fillCubeSides` log reports into a placement that can be repeated.
 *
 * It asserts the CORRECT behaviour on purpose, so it can go red. A red here is
 * the reproduction, not a flake to soften.
 *
 * The offsets are a search range, not a measured constant: the point is to
 * cover the window, and any one of them landing is the finding.
 *
 * A PASS REPORTS WHETHER IT EXERCISED ANYTHING, because a green sweep and a
 * sweep that never opened the window look identical otherwise. After the first
 * fill each offset reads the not-yet-typed sides: only the suggestion effect
 * writes all six, so any of sides 2 to 6 holding an id means the write landed
 * inside the first fill and that offset really did test the mechanism. The
 * closing line names the offsets where it happened, or says plainly that the
 * pass proved nothing about placement.
 *
 * Measured locally with the offsets below: 5 of 10 and 3 of 10 opened the
 * window, always at the larger ones, which is where the chain's resolution
 * falls on this machine. In every case the typed value survived. A handful of
 * samples on one machine is not a result, it is the start of a count, and the
 * same line in CI turns each run into another sample. If the window is opened
 * often and the sweep still never reddens, the placement hypothesis weakens on
 * evidence rather than on patience.
 *
 * The assertion is mutation-checked separately: a clobber injected before the
 * read fails the pass and names the offset.
 */
// A search range covering the window, not measured constants. The upper end
// matters most: locally the suggestion's chain resolves far enough after the
// form is ready that only the larger offsets put the write inside the first fill,
// and a CI runner is slower, so the range reaches well past what is needed
// here rather than being tuned to this machine.
const FILL_OFFSETS_MS = [0, 100, 200, 300, 400, 600, 900, 1200, 1600, 2000];

test('suggestion-repro: a suggestion landing across the first fill must not drop it', async () => {
  // Offsets at which a whole-form write was actually observed. An empty list
  // means the pass exercised nothing, and it says so rather than passing
  // quietly.
  const observed: number[] = [];

  for (const offset of FILL_OFFSETS_MS) {
    const context = await browser.newContext();
    // Fails the pass on any console.error or uncaught exception from a page of this context.
    const errorGuard = installContextErrorGuard(context);
    const page: Page = await context.newPage();

    await page.goto(CUBES_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="page-title"]')).toBeVisible();
    await openDetails(page, 'configurator-advanced');

    // Wait the offset, then type. The offset IS the placement under test, so
    // it is a duration by design: the suggestion's whole-form write has no
    // signal to type against.
    if (offset > 0) {
      await workaroundWaitForTimeout(
        page,
        offset,
        'placing the first fill at a swept offset after the form is ready; the suggestion write has no signal',
      );
    }
    await page.locator('[data-testid="cube-side-1"]').fill(RENDERABLE_SIDE_IDS[0]);

    // Did a whole-form write actually happen in this pass? The not-yet-typed
    // sides answer it: only the suggestion effect writes all six, so any of
    // sides 2 to 6 holding an id means the write landed and this offset really
    // did exercise the window. Without this the pass reports success whether
    // or not anything happened, which is the silent green this spec exists to
    // avoid.
    const untyped = await Promise.all([1, 2, 3, 4, 5].map((i) =>
      page.locator(`[data-testid="cube-side-${i + 1}"]`).inputValue()));
    if (untyped.some((v) => v !== '')) observed.push(offset);

    for (let i = 1; i < 6; i++) {
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
    errorGuard.assertClean();
    await context.close();

    expect(
      lost.map(({ i }) => i + 1),
      `first fill +${offset}ms after the form was ready: these sides did not keep the typed value`,
    ).toEqual([]);
  }

  console.log(observed.length === 0
    ? `[repro] no suggestion landed at any of the ${FILL_OFFSETS_MS.length} offsets; ` +
      'this pass proved NOTHING about placement'
    : `[repro] a whole-form write was observed at ${observed.length} of ` +
      `${FILL_OFFSETS_MS.length} offsets (${observed.join(', ')} ms); ` +
      'the window was exercised and the typed values survived it');
});

