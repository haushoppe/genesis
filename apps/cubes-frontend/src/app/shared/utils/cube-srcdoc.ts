/**
 * On-chain cube display via `srcdoc`, so the iframe shows the cube's stage
 * from its very first frame and never a white or flat canvas.
 *
 * Why not a cross-origin `src` to `/preview/<id>`: a cube's HTML sets no body
 * background, and the browser paints a cross-origin document's canvas in its
 * OWN default colour (white in light mode, and measured white even when the
 * parent page is dark, because the parent's `color-scheme` never crosses the
 * document boundary). That white stays until the cube's script runs, a window
 * of well over a second per tile, so every scroll-in is a white flash. Owning
 * the document is the only way to paint it before the script runs: fetch the
 * bytes, wrap, srcdoc.
 *
 * What the on-chain renderer paints, and what this replicates: the renderer
 * injects a `<style>` giving the body a sky gradient (`t` at 20% to `u` at 80%,
 * top to bottom), draws on a TRANSPARENT WebGL canvas, and adds a lit floor
 * plane in `k` that forms the horizon. `t`, `u`, `k` default to black, #5a5a5a,
 * #202020 and a cube may override them via fields 9, 10, 8 of its `t='…'`
 * list. The stage CSS here reproduces that look (sky, horizon, floor) with the
 * cube's own colours, so the document looks like the finished stage before the
 * renderer has even loaded; only the cube itself appears when the scene paints.
 *
 * The wrapping is display-only. It never touches the minted body (which stays
 * the pristine canonical cube) and the fetched bytes are the real on-chain
 * bytes; only the display container gains a head.
 *
 * Measured and final: see CLAUDE.md "HARD RULE: Cube iframes render via srcdoc
 * + dark canvas" for the proof, the approaches that already failed, and the
 * measurement any replacement has to pass.
 */

const COLOR_SCHEME_META = '<meta name="color-scheme" content="dark">';

/**
 * Keeps a face from going black when its side is an SVG without an intrinsic
 * size (`width="100%"` and no height, or only a `viewBox`).
 *
 * The renderer hands every side straight to three.js as an `<img>`. Chrome
 * gives such an SVG a placeholder size as an image, so it loads and decodes,
 * but refuses it as a WebGL texture source: the upload fails with
 * `INVALID_VALUE` ("bad image data") and the face stays black. Measured on
 * ordinals.com's own preview too, so it is the browser and the on-chain
 * renderer meeting, not this app; the cubes concerned rendered before Chrome
 * tightened this.
 *
 * The shim gives the browser what it will accept: on a failed upload the same
 * image is drawn onto a canvas and that canvas is uploaded instead. The bytes
 * are the cube's own, nothing is substituted, and an upload that succeeds
 * natively is untouched. Rasterising needs an origin-clean image, hence the
 * `crossOrigin` on every `<img>` the document creates; both hosts that serve
 * cube content (`ordinals.com`, `api.ordpool.space`) answer with
 * `access-control-allow-origin: *`.
 *
 * The canvas keeps the image's own pixel size: in WebGL2 three.js allocates
 * immutable storage from it (`texStorage2D`), and a differently sized upload
 * would be rejected.
 */
export const TEXTURE_SHIM = `<script>(function(){
var C=function(el,name){if(String(name).toLowerCase()==='img'){try{el.crossOrigin='anonymous'}catch(e){}}return el};
var ns=Document.prototype.createElementNS;Document.prototype.createElementNS=function(u,n){return C(ns.apply(this,arguments),n)};
var ce=Document.prototype.createElement;Document.prototype.createElement=function(n){return C(ce.apply(this,arguments),n)};
function raster(img){var w=img.naturalWidth||300,h=img.naturalHeight||150;var c=ce.call(document,'canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);return c}
function patch(p,n){if(!p||!p[n])return;var o=p[n];p[n]=function(){var a=Array.prototype.slice.call(arguments),i=a.length-1,s=a[i];
if(typeof HTMLImageElement!=='undefined'&&s instanceof HTMLImageElement){while(this.getError()!==this.NO_ERROR){}o.apply(this,a);
if(this.getError()===this.INVALID_VALUE){try{a[i]=raster(s);o.apply(this,a)}catch(e){}}return}
return o.apply(this,a)}}
if(typeof WebGLRenderingContext!=='undefined'){patch(WebGLRenderingContext.prototype,'texImage2D');patch(WebGLRenderingContext.prototype,'texSubImage2D')}
if(typeof WebGL2RenderingContext!=='undefined'){patch(WebGL2RenderingContext.prototype,'texImage2D');patch(WebGL2RenderingContext.prototype,'texSubImage2D')}
})();<\/script>`;

/** The renderer's stage defaults: sky top `t`, sky bottom `u`, floor `k`. All
 *  three renderer versions (v1, v2, v3) paint this same stage, so the replica
 *  applies to every cube. */
export const STAGE_DEFAULTS = { t: '#000000', u: '#5a5a5a', k: '#202020' } as const;

/** A colour the stage CSS accepts verbatim: hex, or a plain CSS colour name. */
const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{1,30})$/;

/**
 * The stage as CSS: the renderer's own sky gradient, plus a floor replica from
 * the horizon (52%) darkening into `k`, drawn on top of the sky. Declared
 * `!important` because the renderer later injects its own `body { background }`
 * (sky only); without the precedence the floor replica would vanish for the
 * frames between that injection and the first WebGL paint of the real floor.
 */
export function stageCss(colors: { t: string; u: string; k: string } = STAGE_DEFAULTS): string {
  const { t, u, k } = colors;
  return (
    'html,body{width:100%;height:100%;margin:0}' +
    `body{background-color:${t}!important;background-image:` +
    `linear-gradient(180deg,transparent 52%,${t} 52%,${k} 90%),` +
    `linear-gradient(180deg,${t} 20%,${u} 80%)!important}`
  );
}

/**
 * The stage colours a cube's HTML asks the renderer for: fields 8 (floor `k`),
 * 9 (sky top `t`), 10 (sky bottom `u`) of its `t='…'` list, each falling back
 * to the renderer default when absent or not a plain colour.
 */
export function stageColorsOf(cubeHtml: string): { t: string; u: string; k: string } {
  const m = cubeHtml.match(/<script>t='([^']*)'<\/script>/);
  const w = m ? m[1].split('|') : [];
  const pick = (i: number, fallback: string) => (w[i] && SAFE_COLOR.test(w[i]) ? w[i] : fallback);
  return { k: pick(8, STAGE_DEFAULTS.k), t: pick(9, STAGE_DEFAULTS.t), u: pick(10, STAGE_DEFAULTS.u) };
}

/**
 * Wrap a cube's HTML for display as `srcdoc`.
 *
 * - `<base href>`: the on-chain cube script loads its renderer and every side
 *   via relative `/content/…`. Inside a srcdoc those would resolve against the
 *   app origin and bounce through the `/content/*` edge redirect once per
 *   resource; the base points them straight at the ord that serves the cube.
 * - `color-scheme: dark` meta: the canvas defaults dark, not white.
 * - the stage `<style>`, in the cube's own colours, so the document looks like
 *   the finished stage before the renderer script has run.
 * - the texture shim, so a side that Chrome will not upload as a texture
 *   (an SVG without an intrinsic size) still shows instead of going black.
 *
 * `rootHref` is the ord's root, e.g. `https://ordinals.com/`. Handles both
 * source shapes: a body that already has a `<head>` (titled cube) gets the
 * tags prepended inside it; a bare body gets a fresh `<head>`.
 */
export function wrapCubeForSrcdoc(cubeHtml: string, rootHref: string): string {
  const inject = `<base href="${rootHref}">${COLOR_SCHEME_META}<style>${stageCss(stageColorsOf(cubeHtml))}</style>${TEXTURE_SHIM}`;
  if (/<head\b[^>]*>/i.test(cubeHtml)) {
    return cubeHtml.replace(/<head\b[^>]*>/i, (m) => `${m}${inject}`);
  }
  return cubeHtml.replace(/^<html\b[^>]*>/i, (m) => `${m}<head>${inject}</head>`);
}

/**
 * The document an iframe shows while it is out of the viewport, or while its
 * cube fetch is still in flight: the default stage, nothing on it. Swapping
 * placeholder ↔ cube is therefore stage ↔ stage; only the cube appears.
 */
export const DARK_PLACEHOLDER_SRCDOC =
  `<html><head>${COLOR_SCHEME_META}<style>${stageCss()}</style></head><body></body></html>`;

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
