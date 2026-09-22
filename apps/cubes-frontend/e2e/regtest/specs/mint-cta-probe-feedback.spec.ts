import { test, expect, chromium, Browser, Page } from '@playwright/test';

import { environment as regtestEnvironment } from '../../../src/environments/environment.regtest';
import { fillCubeSides, openDetails, RENDERABLE_SIDE_IDS, screenshotWhenFontsReady } from '../regtest-helpers';

/**
 * The disabled Mint button has to say why it is disabled.
 *
 * `canOpenCheckout` requires every side to decode as an image, because a side
 * that does not renders as a black face and curses the cube. So the button is
 * correctly off while the probe runs. What was wrong is that every explanatory
 * branch beside it is suppressed for exactly that window, so a reader saw a
 * dead control and nothing accounting for it, which is indistinguishable from
 * a broken page and was reported as a dead first click.
 *
 * Proving it needs the probe held open, because it normally answers in well
 * under a second and the window is not reliably observable. The spec delays the
 * probe's own image requests, asserts the state a reader would see, then
 * releases them and asserts the button becomes usable. Without the delay this
 * spec would pass against a build that shows nothing at all, since it would
 * only ever sample the settled state.
 */

const APP_URL = 'http://localhost:4203/';
// Read from the regtest environment rather than repeated here: the probe host
// moved to the stack's own ord when the mainnet reaches were removed, and a
// hardcoded copy silently stopped intercepting anything, so the state this
// spec exists to observe never appeared.
const PROBE_HOST = regtestEnvironment.sideImageProbeBase;

let browser: Browser;
let page: Page;

test.beforeAll(async () => {
  browser = await chromium.launch();
});

test.afterAll(async () => {
  await browser?.close();
});

test('mint-cta: while the side probe runs, the page says why the button is off', async () => {
  test.setTimeout(120_000);

  page = await browser.newPage();

  // Navigate FIRST, then start holding. The hold below blocks every request to
  // the probe host, and the page's own load pulls images from that same host,
  // so installing the route first makes `page.goto` wait for a load event that
  // the route itself is preventing. That is a deadlock of the spec's own making
  // and it timed out at 30s in CI while passing locally on timing.
  //
  // `domcontentloaded` for the same reason: this spec deliberately leaves
  // requests outstanding, so waiting for a quiet load is waiting for something
  // it has decided will not happen.
  // Installed BEFORE navigation. The suggestion now pre-fills six ids on load
  // and the probe resolves them immediately, so a route installed after goto
  // arrives too late: the results are already cached and the "checking" state
  // this spec observes never appears. Installing it first is safe now that the
  // probe host is the stack's own ord and no longer serves the page's assets,
  // which is what made an early route deadlock goto previously.
  // Hold every probe image until released. The probe loads each side from
  // `sideImageProbeBase`, which is the same host the cubes index uses.
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`${PROBE_HOST}/content/**`, async (route) => {
    await held;
    await route.abort();
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });


  await openDetails(page, 'configurator-advanced');
  await fillCubeSides(page, RENDERABLE_SIDE_IDS);

  // The state a reader meets: button off, and a reason on screen.
  const cta = page.locator('[data-testid="mint-cta"]');
  const checking = page.locator('[data-testid="mint-checking-sides"]');
  await expect(checking).toBeVisible({ timeout: 20_000 });
  await expect(cta).toBeDisabled();
  await expect(checking).toHaveText(/checking that all six sides render/i);

  // The button must also LOOK unavailable, not merely be inert. Measured
  // rather than eyeballed: on the screenshot it reads as a vivid, clickable
  // orange, and the temptation was to restyle it. It is dimmed to 0.65 and
  // carries a not-allowed cursor, so the affordance is already correct and the
  // missing piece was only the reason. Pinned here so a future style change
  // cannot quietly produce a button that looks live while refusing clicks.
  const look = await cta.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { opacity: Number(cs.opacity), cursor: cs.cursor };
  });
  expect(look.opacity).toBeLessThan(1);
  expect(look.cursor).toBe('not-allowed');

  await screenshotWhenFontsReady(page, { path: 'test-results-regtest/mint-cta-probe-feedback.png' });

  // Released, the probe answers and the button becomes usable. Asserted so the
  // message cannot be a permanent fixture that merely happens to be present.
  release!();
  await expect(checking).toBeHidden({ timeout: 30_000 });
});
