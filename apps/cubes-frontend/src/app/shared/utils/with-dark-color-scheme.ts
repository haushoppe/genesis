/**
 * Wraps a cube's on-chain HTML body in a small display shell that
 * declares dark colour-scheme, so the iframe canvas renders dark
 * instead of white during the seconds between `srcdoc` binding and
 * the cube's own 3D scene painting.
 *
 * Why this exists — mobile Chrome white-iframe bug:
 * ---------------------------------------------------
 * The on-chain cube HTML is:
 *   `<html><!--cubes.haushoppe.art--><body><script>t='…'</script>
 *    <script src=/content/RENDERER></script>`
 * It sets no body-bg. A browser whose OS `prefers-color-scheme` is
 * `light` (mobile Chrome default) paints the iframe's canvas WHITE
 * until the cube's JS builds its 3D scene — a multi-second flash of
 * bright white on every iframe on first paint.
 *
 * `<meta name="color-scheme" content="dark">` is the *only* mechanism
 * a browser honours to change the canvas colour for a document that
 * doesn't set its own body-bg. `iframe { color-scheme: dark }` from
 * the parent does NOT cross the document boundary (verified live on
 * cross-origin iframes 2026-08-07). And modifying the on-chain HTML
 * itself would break `parseCube`'s round-trip check and would change
 * the bytes the SDK signs onto Bitcoin.
 *
 * So we wrap at the display boundary: prepend a `<head>` with the
 * meta tag (and the same for `<html>`-with-title paths — we insert
 * an extra `<head>` sibling; browsers merge multiple head children
 * per the HTML parsing spec). The `<!--cubes.haushoppe.art-->` marker
 * that survives to on-chain parsing still comes verbatim from the
 * unwrapped body, so `parseCube` continues to identify these.
 *
 * The wrapped output is srcdoc-only. Never pass it to any inscribe
 * flow — the SDK expects the exact `getCubeHtml()` bytes, not this
 * wrapped shell.
 */
export function withDarkColorScheme(cubeBodyHtml: string): string {
  // Handle both template shapes:
  //   1. `<html><!--marker--><body>…`            (no-title path)
  //   2. `<html><!--marker--><head><title>…`     (with-title path)
  // In both cases, inserting `<head><meta …></head>` immediately after
  // `<html>` and before `<!--marker-->` produces valid HTML that
  // browsers parse as intended.
  const META_HEAD = '<head><meta name="color-scheme" content="dark"></head>';
  return cubeBodyHtml.replace(/^<html>/i, `<html>${META_HEAD}`);
}
