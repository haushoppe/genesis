import { describe, expect, it } from 'vitest';

import {
  allSidesRender,
  blackFaces,
  ProbeImage,
  probeSideImage,
  probeSideImages,
  SideImageVerdict,
} from './side-image-check';

/**
 * `ProbeImage` picks its fields off `HTMLImageElement`, which carries the
 * readonly modifier with them: the browser sets a decoded image's size and
 * the production code only reads it. A fake has to play the browser's half,
 * so it writes through a mutable view of the same type rather than a looser
 * one, and stays assignable to `ProbeImage` for the code under test.
 */
type MutableProbeImage = { -readonly [K in keyof ProbeImage]: ProbeImage[K] };

/** A fake `Image` that settles according to a per-url script the test controls. */
function fakeImages(script: Record<string, { event: 'load' | 'error'; width: number; height: number }>) {
  const requested: string[] = [];
  const factory = (): ProbeImage => {
    const img: MutableProbeImage = {
      naturalWidth: 0,
      naturalHeight: 0,
      onload: null,
      onerror: null,
      set src(url: string) {
        requested.push(url);
        const outcome = script[url];
        if (!outcome) throw new Error(`unexpected image url ${url}`);
        img.naturalWidth = outcome.width;
        img.naturalHeight = outcome.height;
        queueMicrotask(() => {
          const handler = outcome.event === 'load' ? img.onload : img.onerror;
          handler?.call(img as unknown as GlobalEventHandlers & Window, new Event(outcome.event));
        });
      },
      get src() { return requested[requested.length - 1] ?? ''; },
    };
    return img;
  };
  return { factory, requested };
}

const BASE = 'https://api.ordpool.space';
const PNG = 'df58fbb44dbb2a9b17405f944c8ff966fd120cccda87873f3206f012ea239bebi0';
const JSON_SIDE = 'a1aff8c3dc8ff01c775d3de7400ec6734b5fd289e8cff33b3fed8cd7da422fafi1';
const MISSING = '7f06d41d3660200b412e86e0ee264adbaee049b761752227225e35a3eb2838b0i07';

describe('probeSideImage', () => {
  it('asks the renderer\'s question: /content/<id> on the content host, as an image', async () => {
    const { factory, requested } = fakeImages({ [`${BASE}/content/${PNG}`]: { event: 'load', width: 600, height: 600 } });
    expect(await probeSideImage(PNG, BASE, factory)).toBe('ok');
    expect(requested).toEqual([`${BASE}/content/${PNG}`]);
  });

  it('a body the browser cannot decode fires error and is black', async () => {
    const { factory } = fakeImages({ [`${BASE}/content/${JSON_SIDE}`]: { event: 'error', width: 0, height: 0 } });
    expect(await probeSideImage(JSON_SIDE, BASE, factory)).toBe('black');
  });

  it('an image that loads with no intrinsic size is black too', async () => {
    const { factory } = fakeImages({ [`${BASE}/content/${PNG}`]: { event: 'load', width: 0, height: 0 } });
    expect(await probeSideImage(PNG, BASE, factory)).toBe('black');
  });

  it('a load that never settles gives up as unknown rather than hanging', async () => {
    // A connection that opens and delivers nothing fires neither handler, so
    // without a deadline this promise never resolves and the five other sides
    // are withheld with it, since they are awaited together.
    const neverSettles = (): ProbeImage => ({
      naturalWidth: 0, naturalHeight: 0, onload: null, onerror: null, src: '',
    });
    expect(await probeSideImage(PNG, BASE, neverSettles, 10)).toBe('unknown');
  });

  it('one stalled side does not withhold the others', async () => {
    const script: Record<string, { event: 'load' | 'error'; width: number; height: number }> = {
      [`${BASE}/content/${PNG}`]: { event: 'load', width: 600, height: 600 },
    };
    const { factory } = fakeImages(script);
    const createImage = (): ProbeImage => {
      // The first call is the stalled side, the rest answer normally.
      if (!stalledUsed) { stalledUsed = true; return { naturalWidth: 0, naturalHeight: 0, onload: null, onerror: null, src: '' }; }
      return factory();
    };
    let stalledUsed = false;
    expect(await probeSideImages([MISSING, PNG], BASE, createImage, 10)).toEqual({
      [MISSING]: 'unknown',
      [PNG]: 'ok',
    });
  });
});

describe('probeSideImages', () => {
  it('returns one verdict per id, keyed by id', async () => {
    const { factory } = fakeImages({
      [`${BASE}/content/${PNG}`]: { event: 'load', width: 150, height: 150 },
      [`${BASE}/content/${MISSING}`]: { event: 'error', width: 0, height: 0 },
    });
    expect(await probeSideImages([PNG, MISSING], BASE, factory)).toEqual({ [PNG]: 'ok', [MISSING]: 'black' });
  });
});

describe('blackFaces / allSidesRender', () => {
  const verdicts: Record<string, SideImageVerdict> = { [PNG]: 'ok', [JSON_SIDE]: 'black', [MISSING]: 'black' };

  it('names the 1-based faces whose side is black', () => {
    expect(blackFaces([PNG, JSON_SIDE, PNG, PNG, MISSING, PNG], verdicts)).toEqual([2, 5]);
  });

  it('lists nothing while there are no verdicts or for sides without one', () => {
    expect(blackFaces([PNG, JSON_SIDE], null)).toEqual([]);
    expect(blackFaces(['unknown-id', ''], verdicts)).toEqual([]);
  });

  it('a probe that never answered does not block the mint, and is not called black', () => {
    // The content host being slow or blocked is not evidence about anyone's
    // inscriptions. It must not disable Mint, and it must not be reported as a
    // black face, or the reader is told their cube is broken by an outage.
    const stalled: Record<string, SideImageVerdict> = { [PNG]: 'unknown' };
    expect(allSidesRender([PNG, PNG, PNG, PNG, PNG, PNG], stalled)).toBe(true);
    expect(blackFaces([PNG, PNG], stalled)).toEqual([]);
  });

  it('still blocks while a side has no verdict at all', () => {
    // Different from 'unknown': the probe has not finished, so the question is
    // open rather than answered.
    expect(allSidesRender([PNG, 'not-probed-yet'], { [PNG]: 'unknown' })).toBe(false);
  });

  it('one black side still blocks even when the others are unknown', () => {
    const mixed: Record<string, SideImageVerdict> = { [PNG]: 'unknown', [JSON_SIDE]: 'black' };
    expect(allSidesRender([PNG, JSON_SIDE], mixed)).toBe(false);
    expect(blackFaces([PNG, JSON_SIDE], mixed)).toEqual([2]);
  });

  it('allSidesRender needs a verdict of ok for every side', () => {
    expect(allSidesRender([PNG, PNG, PNG, PNG, PNG, PNG], verdicts)).toBe(true);
    expect(allSidesRender([PNG, JSON_SIDE, PNG, PNG, PNG, PNG], verdicts)).toBe(false);
    expect(allSidesRender([PNG, '', PNG, PNG, PNG, PNG], verdicts)).toBe(false);
    expect(allSidesRender([PNG, 'not-probed-yet', PNG, PNG, PNG, PNG], verdicts)).toBe(false);
    expect(allSidesRender([PNG], null)).toBe(false);
  });
});
