import { withDarkColorScheme } from './with-dark-color-scheme';

// CORS-enabled, so the response can go into a srcdoc.
const ORD_CONTENT_BASE = 'https://ordinals.com/content';

// Cube bodies are on-chain immutable, so cache forever.
const cache = new Map<string, Promise<string>>();

/**
 * Fetch a cube body and wrap it so the iframe canvas paints dark from
 * first frame — see `withDarkColorScheme`.
 */
export function fetchCubeSrcdoc(inscriptionId: string): Promise<string> {
  const hit = cache.get(inscriptionId);
  if (hit) return hit;
  const promise = fetch(`${ORD_CONTENT_BASE}/${inscriptionId}`, {
    headers: { 'Accept': 'text/html,*/*' },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`${ORD_CONTENT_BASE}/${inscriptionId} → HTTP ${res.status}`);
      return res.text();
    })
    .then((body) => withDarkColorScheme(body));
  cache.set(inscriptionId, promise);
  promise.catch(() => cache.delete(inscriptionId));
  return promise;
}
