import { withDarkColorScheme } from './with-dark-color-scheme';

/**
 * Cross-origin ord instance that serves the raw HTML body of any
 * inscription. CORS-enabled (`Access-Control-Allow-Origin: *`), so we
 * can `fetch()` an inscription's body from the browser and turn it
 * into a `srcdoc` blob — bypassing the "cross-origin src iframe with
 * white canvas" trap that mobile Chrome falls into.
 *
 * See `withDarkColorScheme` for the flash-mitigation this fetch
 * enables. Alternative would be `/content/<id>` on our own origin
 * (Cloudflare Pages redirects it), but the redirect target is
 * cross-origin anyway; fetching directly here means one round-trip
 * instead of one-plus-redirect.
 */
const ORD_CONTENT_BASE = 'https://ord.ordpool.space/content';

/**
 * Session-lifetime cache of fetched cube bodies. Same-cube-across-
 * many-viewports (details + tiles + banner may all reference the
 * same id) share one fetch. Cube bodies are on-chain immutable so
 * caching forever is safe.
 */
const cache = new Map<string, Promise<string>>();

/**
 * Fetch a cube inscription's raw HTML body from `ord.ordpool.space`,
 * wrap it in the dark-color-scheme display shell, and return HTML
 * ready to hand to an iframe's `srcdoc`. Results are cached by id
 * for the session.
 *
 * The wrapped body renders in an iframe whose canvas paints DARK
 * from first paint, avoiding the mobile-Chrome white flash. The
 * cube's own JS still runs unchanged; the wrapper only prepends a
 * `<head><meta name="color-scheme" content="dark"></head>` and
 * doesn't touch the body or the cube's inline scripts.
 *
 * On fetch failure the promise rejects; callers should fall back to
 * either a static placeholder or the raw cross-origin src.
 */
export function fetchCubeSrcdoc(inscriptionId: string): Promise<string> {
  const hit = cache.get(inscriptionId);
  if (hit) return hit;
  const promise = fetch(`${ORD_CONTENT_BASE}/${inscriptionId}`, {
    headers: { 'Accept': 'text/html,*/*' },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`ord.ordpool.space/content/${inscriptionId} → HTTP ${res.status}`);
      return res.text();
    })
    .then((body) => withDarkColorScheme(body));
  cache.set(inscriptionId, promise);
  // On failure evict from cache so a later retry has a chance.
  promise.catch(() => cache.delete(inscriptionId));
  return promise;
}
