import { expect, test } from '@playwright/test';

// A mid-list cube that's guaranteed to have BOTH a previous and a next
// neighbour in the cubes index (i.e. not the first or last entry). Used by
// the keyboard-navigation tests below; the inscription itself is the
// 'Bitcoin Burials' cube #266 in our static index.
const KNOWN_CUBE_ID = '8a675560a7bb323d9c060b075cd9fc4dc8efc16094a63074b7913d975f94a2d4i0';

test.describe('Start page', () => {
  test('renders the heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ordinal Cubes', exact: true })).toBeVisible();
  });

  test('has the Configure your cube section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Configure your cube' })).toBeVisible();
  });

  test('configurator renders as a two-column layout with form + preview side by side', async ({ page }) => {
    await page.goto('/');
    // Six side inputs live in the left column, the preview in the right —
    // the 2025 shape restored on top of the signal-forms refactor.
    await expect(page.getByTestId('cube-side-1')).toBeVisible();
    await expect(page.getByTestId('cube-side-6')).toBeVisible();
    await expect(page.locator('app-cube-preview')).toBeVisible();
    await expect(page.getByTestId('craft-another-cube')).toBeVisible();
    await expect(page.getByTestId('mint-cta')).toBeVisible();
  });
});

test.describe('Minted cubes gallery — never break silently', () => {
  // Hard regression guard: users MUST always see the previously-minted
  // cubes and their total count. The site has broken multiple times to
  // the point where users couldn't see any of the existing cubes at all.
  // This spec fails loud the moment either the count text goes missing
  // or the grid stops painting inscription tiles.
  //
  // 530 is a floor chosen well below the actual live count so the guard
  // won't false-flag on transient count regressions — it's the "we lost
  // the whole gallery" tripwire, not a "we lost one cube" tripwire.
  const MIN_CUBES = 530;

  test(`start page shows > ${MIN_CUBES} minted cubes AND renders at least one tile`, async ({ page }) => {
    await page.goto('/');

    const totalLocator = page.getByTestId('minted-cubes-total');
    await expect(totalLocator).toBeVisible({ timeout: 15_000 });

    // Poll the DOM until the store hydrates a real count (initial state
    // renders "0"). Keeps the assertion tight without a fixed sleep.
    await expect.poll(async () => {
      const text = (await totalLocator.textContent())?.trim() ?? '';
      return Number.parseInt(text, 10) || 0;
    }, {
      message: `expected minted-cubes-total to hydrate above ${MIN_CUBES}`,
      timeout: 20_000,
    }).toBeGreaterThan(MIN_CUBES);

    // Not just a number — the grid must actually paint cube tiles.
    // Anything less means the list rendered blank and the page is
    // effectively broken for the "browse the gallery" use case.
    const tiles = page.locator('[data-testid="minted-cubes-grid"] app-inscription-list-item');
    await expect(tiles.first()).toBeVisible({ timeout: 15_000 });
    expect(await tiles.count()).toBeGreaterThan(0);
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

test.describe('Start page links', () => {
  test('FAQ link renders as an actual <a href> (regression — RouterLink import was missing)', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /please refer to our FAQ section/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/faq');
  });
});

test.describe('Keyboard navigation', () => {
  test('details page: ArrowRight navigates to the next cube', async ({ page }) => {
    await page.goto(`/inscription/${KNOWN_CUBE_ID}`);
    // Wait for the Previous/Next link container to actually render (proves the
    // inscription data loaded; otherwise the host listener has no target).
    const nextLink = page.locator('a:has-text("Next Cube")');
    await expect(nextLink).toBeVisible({ timeout: 15_000 });
    const nextHref = await nextLink.getAttribute('href');
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(new RegExp(`${nextHref}$`.replace(/[/.]/g, '\\$&')));
  });

  test('details page: ArrowLeft navigates to the previous cube', async ({ page }) => {
    await page.goto(`/inscription/${KNOWN_CUBE_ID}`);
    const prevLink = page.locator('a:has-text("Previous Cube")');
    await expect(prevLink).toBeVisible({ timeout: 15_000 });
    const prevHref = await prevLink.getAttribute('href');
    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(new RegExp(`${prevHref}$`.replace(/[/.]/g, '\\$&')));
  });

  test('start page: ArrowRight advances the cube list to the next page', async ({ page }) => {
    await page.goto('/');
    // Wait for the pagination control to render (means the list has loaded)
    await expect(page.locator('ngb-pagination .page-item.active')).toBeVisible({ timeout: 15_000 });
    const before = await page.locator('ngb-pagination .page-item.active').innerText();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('ngb-pagination .page-item.active')).not.toHaveText(before, { timeout: 10_000 });
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
