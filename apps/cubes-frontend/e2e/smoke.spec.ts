import { expect, test } from '@playwright/test';

// First inscribed cube (the famous Donny cube — cursed inscription #-265038,
// minted block 778921). Stable test fixture: it exists in the static
// ordinal-cubes-index forever, so the detail page always has data.
const KNOWN_CUBE_ID = '72907215a4e32cdbd26dcc5707daaddcf4f6b98a9971fdb6129a46065559226ei0';

test.describe('Start page', () => {
  test('renders the heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ordinal Cubes', exact: true })).toBeVisible();
  });

  test('has the Mint a cube form section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mint a cube' })).toBeVisible();
  });
});

test.describe('Inscription detail page', () => {
  test('loads a known cube detail page', async ({ page }) => {
    await page.goto(`/inscription/${KNOWN_CUBE_ID}`);
    // The page loads cube data from the static GitHub Pages source;
    // give it a generous window since first hit may be a cold edge cache.
    await expect(page.locator('app-details, .cube-detail, [class*="detail"]').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('FAQ page', () => {
  test('renders the FAQ heading', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // FAQ has the "Where can I find suitable inscriptions" question (we just edited this)
    await expect(page.getByText(/inscriptions with images/i)).toBeVisible();
  });

  test('FAQ no longer mentions the sunsetted Hiro link', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.getByRole('link', { name: /Hiro/ })).toHaveCount(0);
  });
});

test.describe('Presskit page', () => {
  test('renders without error', async ({ page }) => {
    await page.goto('/presskit');
    // Just verify the SPA mounted and rendered the route
    await expect(page.locator('app-presskit')).toBeVisible();
  });
});

test.describe('SPA fallback', () => {
  test('unknown route falls through to start (Angular wildcard route)', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz789');
    await expect(page.getByRole('heading', { name: 'Ordinal Cubes', exact: true })).toBeVisible();
  });
});

test.describe('Banner visibility (hideBanner signal)', () => {
  // The `hideBanner` Signal in app.component.ts is fed from router events:
  // routes marked with `data: { hideBanner: true }` cause <app-banner> to
  // be omitted from the DOM. This integration test exercises that end-to-end.

  test('banner IS shown on the start page (no hideBanner data)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-banner')).toBeVisible();
  });

  test('banner is HIDDEN on the inscription detail route (hideBanner: true)', async ({ page }) => {
    await page.goto(`/inscription/${KNOWN_CUBE_ID}`);
    // Wait for the detail page to actually mount before asserting the
    // banner's absence (otherwise we race the initial render).
    await expect(page.locator('app-details, .cube-detail, [class*="detail"]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('app-banner')).toHaveCount(0);
  });
});
