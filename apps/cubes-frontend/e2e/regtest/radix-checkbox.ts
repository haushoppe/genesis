import { expect, type Page, type Locator } from '@playwright/test';

/**
 * Click a Radix UI Checkbox primitive and assert the toggle landed.
 * Vendored from ordpool-sdk/e2e/playwright/radix-checkbox.ts (33 lines,
 * zero-dep, no runtime API — safe to duplicate until wave 1 extracts
 * ordpool-sdk/testing).
 *
 * Radix renders a checkbox as TWO elements: a `<button role="checkbox"
 * data-state="unchecked">` (state lives here) and a hidden
 * `<input type="checkbox">` for form submission. Radix ignores clicks
 * on the input; the deterministic primitive is
 * `getByRole('checkbox').click()`.
 */
export async function clickRadixCheckbox(
  page: Page | Locator,
  options: { nth?: number; timeoutMs?: number } = {},
): Promise<void> {
  const { nth = 0, timeoutMs = 5_000 } = options;
  const checkbox = page.getByRole('checkbox').nth(nth);
  await expect(checkbox).toBeVisible({ timeout: 10_000 });
  await checkbox.click();
  await expect(checkbox).toHaveAttribute('data-state', 'checked', { timeout: timeoutMs });
}
