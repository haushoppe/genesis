/**
 * @test-kind e2e
 * Real:   cubes app on the Angular dev server (ng serve -c regtest), regtest stack (bitcoind
 *         30, ordpool-electrs, cat21-ord, stock ord, ordpool-backend)
 * Faked:  nothing
 * Proves: the start page shows its title, the configurator heading, the six side inputs,
 *         the preview and its controls, the banner and an FAQ link to /faq; /faq and an unknown
 *         route render; the detail route drops the banner; any console.error
 *         or uncaught exception on an app page fails it
 */
import { test, expect, chromium, Browser, BrowserContext, Page } from '@playwright/test';
import { installContextErrorGuard, netLogArgs, offlineLaunchArgs, reachableHosts } from 'ordpool-sdk/e2e';

import { CUBES_URL, openDetails, RENDERABLE_SIDE_IDS } from '../regtest-helpers';

/**
 * The pages and routes of the app that need no wallet and no cubes index: the
 * start page's fixed structure, the FAQ, the presskit, the wildcard route and
 * the banner's route-driven visibility.
 *
 * The regtest build has no cubes index (`cubesIndexBase: ''`), so the minted
 * gallery, a cube's detail data and the keyboard navigation between cubes are
 * not reachable here; this spec covers what renders without them. The presskit
 * is left out: its media load from GitHub releases, which no regtest run reaches.
 */

let browser: Browser;

test.beforeAll(async () => {
  // No wallet extension, so no launchWalletContext, but the same switches it
  // passes: nothing but loopback and the regtest stack resolves, and with
  // ORDPOOL_E2E_NET_LOG_DIR set the net log records what the browser sent.
  browser = await chromium.launch({ args: [...offlineLaunchArgs(reachableHosts()), ...netLogArgs('site-routes')] });
});

test.afterAll(async () => {
  await browser?.close();
});

/** A fresh context with the browser-error guard, and one page in it. */
async function openPage(): Promise<{ context: BrowserContext; page: Page; assertClean: () => void }> {
  const context = await browser.newContext();
  const guard = installContextErrorGuard(context);
  const page = await context.newPage();
  return { context, page, assertClean: () => guard.assertClean() };
}

function url(route: string): string {
  return new URL(route, CUBES_URL).href;
}

test('site-routes: the start page shows the title, the configurator and the banner', async () => {
  const { context, page, assertClean } = await openPage();
  await page.goto(CUBES_URL);

  await expect(page.getByRole('heading', { name: 'Ordinal Cubes', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Craft your cube', exact: true })).toBeVisible();
  // The six side inputs sit behind the "Customize" disclosure, beside the
  // preview and its controls.
  await openDetails(page, 'configurator-advanced');
  for (let side = 1; side <= 6; side++) {
    await expect(page.getByTestId(`cube-side-${side}`)).toBeVisible();
  }
  await expect(page.locator('app-cube-preview')).toBeVisible();
  await expect(page.getByTestId('craft-another-cube')).toBeVisible();
  await expect(page.getByTestId('mint-cta')).toBeVisible();
  await expect(page.locator('app-banner')).toBeVisible();

  // A real link, so the router and a new tab both reach the FAQ.
  const faqLink = page.getByRole('link', { name: /please refer to our FAQ/i });
  await expect(faqLink).toBeVisible();
  await expect(faqLink).toHaveAttribute('href', '/faq');

  assertClean();
  await context.close();
});

test('site-routes: /faq renders its questions without a Hiro link', async () => {
  const { context, page, assertClean } = await openPage();
  await page.goto(url('faq'));

  await expect(page.getByRole('heading', { level: 1, name: 'Frequently Asked Questions' })).toBeVisible();
  await expect(page.getByText(/inscriptions with images/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Hiro/ })).toHaveCount(0);

  assertClean();
  await context.close();
});

test('site-routes: an unknown route falls through to the start page', async () => {
  const { context, page, assertClean } = await openPage();
  await page.goto(url('this-route-does-not-exist-xyz789'));

  await expect(page.getByRole('heading', { name: 'Ordinal Cubes', exact: true })).toBeVisible();
  await expect(page.getByTestId('page-title')).toBeVisible();

  assertClean();
  await context.close();
});

test('site-routes: the detail route drops the banner the start page shows', async () => {
  const { context, page, assertClean } = await openPage();
  await page.goto(CUBES_URL);
  await expect(page.locator('app-banner')).toBeVisible();

  // The route carries `data: { hideBanner: true }`; which cube it names does not
  // matter for the banner, so a fixture inscribed on this chain stands in.
  await page.goto(url(`inscription/${RENDERABLE_SIDE_IDS[0]}`));
  await expect(page.locator('app-details')).toBeAttached();
  await expect(page.locator('app-banner')).toHaveCount(0);

  assertClean();
  await context.close();
});
