import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DARK_PLACEHOLDER_SRCDOC, fetchCubeSrcdoc, ordRootOf, wrapCubeForSrcdoc } from './cube-srcdoc';
import { getCubeHtml } from '../../services/cube-html';
import { parseCube } from '../../../shared/ordinals/parse-cube';

const META = '<meta name="color-scheme" content="dark">';
const sides = {
  inscriptionId1: 'a'.repeat(64) + 'i0', inscriptionId2: 'b'.repeat(64) + 'i0',
  inscriptionId3: 'c'.repeat(64) + 'i0', inscriptionId4: 'd'.repeat(64) + 'i0',
  inscriptionId5: 'e'.repeat(64) + 'i0', inscriptionId6: 'f'.repeat(64) + 'i0',
};
const pristine = getCubeHtml({ inscriptionIds: sides, title: '', rotationSpeedX: '', rotationSpeedY: '', colorPane: '', bgColor1: '', bgColor2: '' });
const titled = getCubeHtml({ inscriptionIds: sides, title: 'My cube', rotationSpeedX: '', rotationSpeedY: '', colorPane: '', bgColor1: '', bgColor2: '' });

describe('wrapCubeForSrcdoc', () => {
  it('injects the dark colour-scheme meta and a base at the ord root', () => {
    const out = wrapCubeForSrcdoc(pristine, 'https://ordinals.com/');
    expect(out).toContain(META);
    expect(out).toContain('<base href="https://ordinals.com/">');
  });

  it('leaves the cube body byte-identical (only the head is added)', () => {
    const bodyTail = pristine.slice(pristine.indexOf('<body>'));
    expect(wrapCubeForSrcdoc(pristine, 'https://ordinals.com/').endsWith(bodyTail)).toBe(true);
  });

  it('prepends inside an existing <head> for a titled cube, keeping the title', () => {
    const out = wrapCubeForSrcdoc(titled, 'https://ordinals.com/');
    expect(out).toContain(`<head><base href="https://ordinals.com/">${META}<title>My cube</title></head>`);
  });

  it('is display-only: the wrapped cube is NOT a canonical (mintable) cube', () => {
    expect(parseCube(pristine)).not.toBeNull();
    expect(parseCube(wrapCubeForSrcdoc(pristine, 'https://ordinals.com/'))).toBeNull();
  });
});

describe('DARK_PLACEHOLDER_SRCDOC', () => {
  it('is a dark document carrying the colour-scheme meta and the stage gradient', () => {
    expect(DARK_PLACEHOLDER_SRCDOC).toContain(META);
    expect(DARK_PLACEHOLDER_SRCDOC).toContain('background-color:#000');
    expect(DARK_PLACEHOLDER_SRCDOC).toContain('linear-gradient(180deg,transparent 52%,black 52%,#212121 90%)');
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
