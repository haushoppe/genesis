/**
 * DISPLAY-ONLY stage emulation for a LOCALLY rendered cube preview.
 *
 * The mint-form preview and the showcase banner render a cube that is not on
 * chain (built live from the form, or a fixed showcase), so they cannot be
 * framed from an ord like the gallery. They render as `srcdoc` and re-render
 * on every keystroke.
 *
 * They get the SAME treatment as the on-chain iframes, which is what stops the
 * flicker: a dark colour-scheme so the canvas never paints white, and the
 * renderer's stage reproduced as CSS in the cube's own colours so the document
 * already looks finished before the renderer script has run. Only the cube
 * appears. `wrapCubeForSrcdoc` in `cube-srcdoc.ts` is the on-chain twin; the
 * one part not shared is its `<base href>`, which a local preview must not
 * have.
 *
 * This is NEVER applied to the minted cube body (that stays the pristine
 * canonical `getCubeHtml`, which the canon regex validates) nor to on-chain
 * cubes (those render straight from ordinals.com). It only ever touches the
 * throwaway local preview copy.
 */
import { stageColorsOf, stageCss, TEXTURE_SHIM } from './cube-srcdoc';

const COLOR_SCHEME_META = '<meta name="color-scheme" content="dark">';

export function withPreviewDarkCanvas(cubeBodyHtml: string): string {
  // Same three parts the on-chain path injects (`wrapCubeForSrcdoc`), minus
  // its `<base href>`, which a local preview must not have: its sides resolve
  // against the app origin.
  //
  // The STAGE STYLE is what stops the flicker. Without it the document paints
  // a flat dark canvas, the renderer then injects its own sky and draws the
  // floor in WebGL, and the step between the two is visible on every
  // re-render. With it the document already looks like the finished stage
  // before the renderer script has run, so only the cube appears.
  //
  // The texture shim rides along so the preview shows exactly what the gallery
  // shows: a side that Chrome refuses as a texture source (an SVG without an
  // intrinsic size) is rasterised instead of leaving the face black.
  const stage = `<style>${stageCss(stageColorsOf(cubeBodyHtml))}</style>`;
  const inject = `${COLOR_SCHEME_META}${stage}${TEXTURE_SHIM}`;
  if (/<head\b[^>]*>/i.test(cubeBodyHtml)) {
    return cubeBodyHtml.replace(/<head\b[^>]*>/i, (m) => `${m}${inject}`);
  }
  return cubeBodyHtml.replace(/^<html\b[^>]*>/i, (m) => `${m}<head>${inject}</head>`);
}
