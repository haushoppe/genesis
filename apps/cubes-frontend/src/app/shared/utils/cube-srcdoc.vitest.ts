import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DARK_PLACEHOLDER_SRCDOC, STAGE_DEFAULTS, fetchCubeSrcdoc, ordRootOf, stageColorsOf, stageCss, wrapCubeForSrcdoc,
} from './cube-srcdoc';
import { getCubeHtml } from '../../services/cube-html';
import { parseCube } from '../../../shared/ordinals/parse-cube';

const META = '<meta name="color-scheme" content="dark">';
const sides = {
  inscriptionId1: 'a'.repeat(64) + 'i0', inscriptionId2: 'b'.repeat(64) + 'i0',
  inscriptionId3: 'c'.repeat(64) + 'i0', inscriptionId4: 'd'.repeat(64) + 'i0',
  inscriptionId5: 'e'.repeat(64) + 'i0', inscriptionId6: 'f'.repeat(64) + 'i0',
};
const blank = { rotationSpeedX: '', rotationSpeedY: '', colorPane: '', bgColor1: '', bgColor2: '' };
const pristine = getCubeHtml({ inscriptionIds: sides, title: '', ...blank });
const titled = getCubeHtml({ inscriptionIds: sides, title: 'My cube', ...blank });

/** The renderer-default stage, exactly as the wrapper and the placeholder paint it. */
const DEFAULT_STAGE =
  'body{background-color:#000000!important;background-image:' +
  'linear-gradient(180deg,transparent 52%,#000000 52%,#202020 90%),' +
  'linear-gradient(180deg,#000000 20%,#5a5a5a 80%)!important}';

describe('wrapCubeForSrcdoc', () => {
  it('injects the dark colour-scheme meta and a base at the ord root', () => {
    const out = wrapCubeForSrcdoc(pristine, 'https://ordinals.com/');
    expect(out).toContain(META);
    expect(out).toContain('<base href="https://ordinals.com/">');
  });

  it('paints the stage (sky gradient + floor replica, !important) in the renderer defaults', () => {
    expect(wrapCubeForSrcdoc(pristine, 'https://ordinals.com/')).toContain(`<style>html,body{width:100%;height:100%;margin:0}${DEFAULT_STAGE}</style>`);
  });

  it('leaves the cube body byte-identical (only the head is added)', () => {
    const bodyTail = pristine.slice(pristine.indexOf('<body>'));
    expect(wrapCubeForSrcdoc(pristine, 'https://ordinals.com/').endsWith(bodyTail)).toBe(true);
  });

  it('prepends inside an existing <head> for a titled cube, keeping the title', () => {
    const out = wrapCubeForSrcdoc(titled, 'https://ordinals.com/');
    expect(out).toContain(`<head><base href="https://ordinals.com/">${META}<style>`);
    expect(out).toContain('<title>My cube</title></head>');
  });

  it('carries the texture shim: a failed image upload retries through a canvas', () => {
    const out = wrapCubeForSrcdoc(pristine, 'https://ordinals.com/');
    // The renderer hands sides to WebGL as <img>; both upload entry points are
    // covered (WebGL2 takes the texSubImage2D path after texStorage2D).
    expect(out).toContain("patch(WebGLRenderingContext.prototype,'texImage2D')");
    expect(out).toContain("patch(WebGL2RenderingContext.prototype,'texSubImage2D')");
    expect(out).toContain('INVALID_VALUE');
    // Rasterising needs an origin-clean image.
    expect(out).toContain("crossOrigin='anonymous'");
    // The shim sits in the head, before the cube's own script tags.
    expect(out.indexOf('texSubImage2D')).toBeLessThan(out.indexOf('<body>'));
  });

  it('is display-only: the wrapped cube is NOT a canonical (mintable) cube', () => {
    expect(parseCube(pristine)).not.toBeNull();
    expect(parseCube(wrapCubeForSrcdoc(pristine, 'https://ordinals.com/'))).toBeNull();
  });

  it('applies the stage to a cube on any renderer version (all three paint the same stage)', () => {
    const otherRenderer = pristine.replace(/src=\/content\/[0-9a-f]{64}i\d+/, `src=/content/${'9'.repeat(64)}i0`);
    expect(otherRenderer).not.toBe(pristine);
    expect(wrapCubeForSrcdoc(otherRenderer, 'https://ordinals.com/')).toContain(DEFAULT_STAGE);
  });
});

describe('stageColorsOf', () => {
  it('returns the renderer defaults for a cube without stage fields', () => {
    expect(stageColorsOf(pristine)).toEqual(STAGE_DEFAULTS);
  });

  it("reads the cube's own floor / sky colours from t= fields 8, 9, 10 (colorPane, bgColor1, bgColor2)", () => {
    const custom = getCubeHtml({ inscriptionIds: sides, title: '', rotationSpeedX: '1', rotationSpeedY: '2', colorPane: '#112233', bgColor1: '#abcdef', bgColor2: '#445566' });
    expect(stageColorsOf(custom)).toEqual({ k: '#112233', t: '#abcdef', u: '#445566' });
    const css = stageCss(stageColorsOf(custom));
    expect(css).toContain('background-color:#abcdef!important');
    expect(css).toContain('linear-gradient(180deg,transparent 52%,#abcdef 52%,#112233 90%)');
    expect(css).toContain('linear-gradient(180deg,#abcdef 20%,#445566 80%)');
  });

  it('falls back to the default for a value that is not a plain colour (no style break-out)', () => {
    const hostile = pristine.replace(/t='([^']*)'/, (_m, list) => `t='${list}|1|2|#112233|red;</style><script>|#445566'`);
    expect(stageColorsOf(hostile).t).toBe(STAGE_DEFAULTS.t);
    // The hostile value stays where it is on chain (in the body's t= list); it
    // must never reach the injected <style> in the head.
    const injectedStyle = wrapCubeForSrcdoc(hostile, 'https://ordinals.com/').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    expect(injectedStyle).toContain('background-color:#000000!important');
    expect(injectedStyle).not.toContain('red;');
  });
});

describe('DARK_PLACEHOLDER_SRCDOC', () => {
  it('is the default stage with nothing on it, carrying the colour-scheme meta', () => {
    expect(DARK_PLACEHOLDER_SRCDOC).toContain(META);
    expect(DARK_PLACEHOLDER_SRCDOC).toContain(DEFAULT_STAGE);
    expect(DARK_PLACEHOLDER_SRCDOC).toContain('<body></body>');
  });
});

describe('ordRootOf', () => {
  it('strips the trailing preview/ segment', () => {
    expect(ordRootOf('https://ordinals.com/preview/')).toBe('https://ordinals.com/');
    expect(ordRootOf('http://127.0.0.1:8999/preview/')).toBe('http://127.0.0.1:8999/');
  });
});

describe('fetchCubeSrcdoc', () => {
  const fetchMock = vi.fn();
  const ok = (body: string) => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body) } as Response);
  const fail = (status: number) => Promise.resolve({ ok: false, status, text: () => Promise.resolve('') } as Response);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fetches the sibling /content/<id> of the preview base and wraps it with that ord root', async () => {
    fetchMock.mockReturnValueOnce(ok(pristine));
    const out = await fetchCubeSrcdoc('id-fetch-1', 'https://ordinals.com/preview/');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://ordinals.com/content/id-fetch-1');
    expect(out).toContain('<base href="https://ordinals.com/">');
    expect(out.endsWith(pristine.slice(pristine.indexOf('<body>')))).toBe(true);
  });

  it('serves a repeat request from cache: one network fetch for two calls', async () => {
    fetchMock.mockReturnValueOnce(ok(pristine));
    const a = await fetchCubeSrcdoc('id-cache-1', 'https://ordinals.com/preview/');
    const b = await fetchCubeSrcdoc('id-cache-1', 'https://ordinals.com/preview/');
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('evicts a failed fetch so the next request retries the network', async () => {
    fetchMock.mockReturnValueOnce(fail(502)).mockReturnValueOnce(ok(pristine));
    await expect(fetchCubeSrcdoc('id-retry-1', 'https://ordinals.com/preview/')).rejects.toThrow('HTTP 502');
    const out = await fetchCubeSrcdoc('id-retry-1', 'https://ordinals.com/preview/');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(out).toContain(META);
  });

  it('keys the cache by source, so the same id from another ord is a separate fetch', async () => {
    fetchMock.mockReturnValueOnce(ok(pristine)).mockReturnValueOnce(ok(pristine));
    await fetchCubeSrcdoc('id-src-1', 'https://ordinals.com/preview/');
    const own = await fetchCubeSrcdoc('id-src-1', 'http://127.0.0.1:8999/preview/');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1:8999/content/id-src-1');
    expect(own).toContain('<base href="http://127.0.0.1:8999/">');
  });
});
