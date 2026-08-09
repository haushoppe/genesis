/**
 * Inject a color-scheme=dark meta AND a <base href> pointing at
 * ordinals.com into a cube's HTML head. Two purposes:
 *
 *  - color-scheme=dark: iframe canvas paints dark instead of white
 *    while the cube JS loads (mobile Chrome light-mode fix).
 *  - base href=ordinals.com: the on-chain cube script has
 *    `<script src=/content/RENDERER>` (relative). Without a base
 *    that resolves via the parent's origin → 301 to ordinals.com,
 *    adding one round-trip per cube iframe. Setting base directly
 *    to ordinals.com skips the redirect.
 *
 * Display-only wrapper. Never send the wrapped body to the SDK.
 *
 * Handles both source shapes: bodies that already have a <head> get
 * the tags prepended inside it; bodies without one get a fresh <head>.
 */
const HEAD_INJECT =
  '<base href="https://ordinals.com/">' +
  '<meta name="color-scheme" content="dark">';

export function withDarkColorScheme(cubeBodyHtml: string): string {
  if (/<head\b[^>]*>/i.test(cubeBodyHtml)) {
    return cubeBodyHtml.replace(/<head\b[^>]*>/i, (m) => `${m}${HEAD_INJECT}`);
  }
  return cubeBodyHtml.replace(/^<html\b[^>]*>/i, (m) => `${m}<head>${HEAD_INJECT}</head>`);
}
