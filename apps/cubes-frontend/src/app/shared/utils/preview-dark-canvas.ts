/**
 * DISPLAY-ONLY dark-canvas hint for a LOCALLY rendered cube preview.
 *
 * The mint-form preview and the showcase banner render a cube that is not
 * on chain (built live from the form, or a fixed showcase), so they cannot
 * be framed from ordinals.com like the gallery. They render as `srcdoc`
 * and re-render on every keystroke; without this the iframe canvas flashes
 * white before three.js paints. A `<meta name="color-scheme" content="dark">`
 * makes the document canvas paint dark instead.
 *
 * This is NEVER applied to the minted cube body (that stays the pristine
 * canonical `getCubeHtml`, which the canon regex validates) nor to on-chain
 * cubes (those render straight from ordinals.com). It only ever touches the
 * throwaway local preview copy.
 */
import { TEXTURE_SHIM } from './cube-srcdoc';

const COLOR_SCHEME_META = '<meta name="color-scheme" content="dark">';

export function withPreviewDarkCanvas(cubeBodyHtml: string): string {
  // The texture shim rides along so the preview shows exactly what the gallery
  // shows: a side that Chrome refuses as a texture source (an SVG without an
  // intrinsic size) is rasterised instead of leaving the face black.
  const inject = `${COLOR_SCHEME_META}${TEXTURE_SHIM}`;
  if (/<head\b[^>]*>/i.test(cubeBodyHtml)) {
    return cubeBodyHtml.replace(/<head\b[^>]*>/i, (m) => `${m}${inject}`);
  }
  return cubeBodyHtml.replace(/^<html\b[^>]*>/i, (m) => `${m}<head>${inject}</head>`);
}
