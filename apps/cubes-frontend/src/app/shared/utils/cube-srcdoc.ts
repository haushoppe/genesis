/**
 * On-chain cube display via `srcdoc`, so the iframe canvas is dark from its
 * very first frame.
 *
 * Why not a cross-origin `src` to `/preview/<id>`: a cube's HTML sets no body
 * background, and the browser paints a cross-origin document's canvas in its
 * OWN default colour (white in light mode, and measured white even when the
 * parent page is dark, because the parent's `color-scheme` never crosses the
 * document boundary). That white stays until the cube's WebGL scene paints,
 * a window of well over a second per tile, so every scroll-in is a white
 * flash. The only thing that darkens the canvas before the scene renders is a
 * `<meta name="color-scheme" content="dark">` INSIDE the iframe's own
 * document, which requires owning the document: fetch the bytes, wrap, srcdoc.
 *
 * The wrapping is display-only. It never touches the minted body (which stays
 * the pristine canonical cube) and the fetched bytes are the real on-chain
 * bytes; only the display container gains a head.
 */

const COLOR_SCHEME_META = '<meta name="color-scheme" content="dark">';

/**
 * Wrap a cube's HTML for display as `srcdoc`.
 *
 * - `color-scheme: dark` meta: the canvas paints dark before the scene renders.
 * - `<base href>`: the on-chain cube script loads its renderer and every side
 *   via relative `/content/…`. Inside a srcdoc those would resolve against the
 *   app origin and bounce through the `/content/*` edge redirect once per
 *   resource; the base points them straight at the ord that serves the cube.
 *
 * `rootHref` is the ord's root, e.g. `https://ordinals.com/`. Handles both
 * source shapes: a body that already has a `<head>` (titled cube) gets the
 * tags prepended inside it; a bare body gets a fresh `<head>`.
 */
export function wrapCubeForSrcdoc(cubeHtml: string, rootHref: string): string {
  const inject = `<base href="${rootHref}">${COLOR_SCHEME_META}`;
  if (/<head\b[^>]*>/i.test(cubeHtml)) {
    return cubeHtml.replace(/<head\b[^>]*>/i, (m) => `${m}${inject}`);
  }
  return cubeHtml.replace(/^<html\b[^>]*>/i, (m) => `${m}<head>${inject}</head>`);
}

/**
 * The document an iframe shows while it is out of the viewport, or while its
 * cube fetch is still in flight. The body paints the same dark stage gradient
 * the cube renderer paints behind a cube, so swapping placeholder ↔ cube is
 * dark ↔ dark, never white. Carries the colour-scheme meta for the same
 * reason the cube does.
 */
export const DARK_PLACEHOLDER_SRCDOC =
  `<html><head>${COLOR_SCHEME_META}<style>` +
  'html,body{width:100%;height:100%;margin:0}' +
  'body{background-color:#000;background-image:' +
  'linear-gradient(180deg,transparent 52%,black 52%,#212121 90%),' +
  'linear-gradient(180deg,#000 20%,#5a5a5a 80%)}' +
  '</style></head><body></body></html>';

/** Root of the ord behind a `…/preview/` base, e.g. `https://ordinals.com/`. */
export function ordRootOf(previewBase: string): string {
  return previewBase.replace(/preview\/$/, '');
}

// Cube bodies are on-chain immutable, so a fetched body never goes stale.
// Bounded LRU (touch-on-hit, evict-oldest) so a long session (prev/next nav,
// big grids) cannot grow it without limit; Map iterates in insertion order,
// so the first key is the least recently used.
const CACHE_MAX = 200;
const cache = new Map<string, Promise<string>>();

/**
 * Fetch a cube's on-chain HTML from the ord behind `previewBase` (its sibling
 * `/content/<id>`) and return it wrapped for srcdoc. Cached per source+id.
 * A failed fetch is evicted so a retry can succeed.
 */
export function fetchCubeSrcdoc(inscriptionId: string, previewBase: string): Promise<string> {
  const root = ordRootOf(previewBase);
  const key = `${root}content/${inscriptionId}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const promise = fetch(key, { headers: { Accept: 'text/html,*/*' } })
    .then((res) => {
      if (!res.ok) throw new Error(`${key} → HTTP ${res.status}`);
      return res.text();
    })
    .then((body) => wrapCubeForSrcdoc(body, root));
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return promise;
}
