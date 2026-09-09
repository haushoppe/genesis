import { environment } from '../../../environments/environment';
import { withDarkColorScheme } from './with-dark-color-scheme';

// Derive the CORS-enabled /content base from the environment's
// /preview base — regtest points at localhost:8081 so tests hit
// the local ord instead of mainnet.
const ORD_CONTENT_BASE = environment.ordinalsExplorerIframe.replace(/\/preview\/$/, '/content');

// Cube bodies are on-chain immutable, so a fetched body never goes stale.
// Bound the session cache with a small LRU (touch-on-hit + evict-oldest) so a
// long browsing session (prev/next nav, large grids) can't grow it without
// limit. Map iterates in insertion order, so the first key is least-recently-used.
const CACHE_MAX = 200;
const cache = new Map<string, Promise<string>>();

/**
 * Fetch a cube body and wrap it so the iframe canvas paints dark from
 * first frame — see `withDarkColorScheme`.
 */
export function fetchCubeSrcdoc(inscriptionId: string): Promise<string> {
  const hit = cache.get(inscriptionId);
  if (hit) {
    // LRU touch: re-insert so a re-viewed cube becomes newest and isn't evicted next.
    cache.delete(inscriptionId);
    cache.set(inscriptionId, hit);
    return hit;
  }
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
  // Evict the least-recently-used entry once over the cap.
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return promise;
}
