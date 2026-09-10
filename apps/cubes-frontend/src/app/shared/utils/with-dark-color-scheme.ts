import { PREVIEW_FALLBACK_SIDE_MARKER } from '../../services/cube-html';

/**
 * Wrap a cube's HTML head for DISPLAY in an iframe. Never send the
 * wrapped body to the SDK.
 *
 *  - color-scheme=dark: the iframe canvas paints dark instead of white
 *    while the cube JS loads (mobile Chrome light-mode fix). Always on.
 *  - base href=ordinals.com: the on-chain cube script uses relative
 *    `/content/…` for the renderer and every side, so the base points
 *    those straight at ordinals.com and skips the `/content/* →
 *    ordinals.com` edge redirect (one round-trip per fetch).
 *
 * The base is OMITTED when the body carries a preview-fallback side
 * (`../assets/…`, see `PREVIEW_FALLBACK_SIDE_MARKER`). Those sides
 * render by climbing out of `/content/` back to `/assets/…`, which
 * only reaches our own asset when the iframe base is the app origin;
 * under an ordinals.com base they 404. A preview with empty sides is
 * the transient pre-pick state, so the skipped redirect there costs
 * nothing. A real cube never contains that marker and always gets the
 * fast base.
 *
 * Handles both source shapes: bodies that already have a <head> get
 * the tags prepended inside it; bodies without one get a fresh <head>.
 */
const COLOR_SCHEME_META = '<meta name="color-scheme" content="dark">';
const BASE_HREF = '<base href="https://ordinals.com/">';

export function withDarkColorScheme(cubeBodyHtml: string): string {
  const usesAppOriginBase = cubeBodyHtml.includes(PREVIEW_FALLBACK_SIDE_MARKER);
  const headInject = (usesAppOriginBase ? '' : BASE_HREF) + COLOR_SCHEME_META;

  if (/<head\b[^>]*>/i.test(cubeBodyHtml)) {
    return cubeBodyHtml.replace(/<head\b[^>]*>/i, (m) => `${m}${headInject}`);
  }
  return cubeBodyHtml.replace(/^<html\b[^>]*>/i, (m) => `${m}<head>${headInject}</head>`);
}
