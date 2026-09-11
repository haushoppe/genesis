import { describe, expect, it } from 'vitest';

import { allSidesFilled, pickSides, suggestionMayReplace } from './suggestion-replaces';

const blank = { inscriptionId1: '', inscriptionId2: '', inscriptionId3: '', inscriptionId4: '', inscriptionId5: '', inscriptionId6: '' };
const cubeA = { inscriptionId1: 'a1', inscriptionId2: 'a2', inscriptionId3: 'a3', inscriptionId4: 'a4', inscriptionId5: 'a5', inscriptionId6: 'a6' };

describe('suggestionMayReplace', () => {
  it('replaces a blank form (the first suggestion after page load)', () => {
    expect(suggestionMayReplace(blank, null)).toBe(true);
  });

  it('never replaces sides the user typed when no craft is pending', () => {
    expect(suggestionMayReplace({ ...blank, inscriptionId3: 'typed' }, null)).toBe(false);
    expect(suggestionMayReplace(cubeA, null)).toBe(false);
  });

  it('replaces the sides a "Craft another cube" click snapshotted, so the old cube stays until the new one lands', () => {
    expect(suggestionMayReplace(cubeA, { ...cubeA })).toBe(true);
  });

  it('keeps the user\'s edit when they changed a side after clicking craft', () => {
    expect(suggestionMayReplace({ ...cubeA, inscriptionId2: 'edited' }, { ...cubeA })).toBe(false);
  });
});

describe('pickSides / allSidesFilled', () => {
  it('picks exactly the six sides off a larger form object', () => {
    expect(pickSides({ ...cubeA, feeRate: 10, title: 'x' } as never)).toEqual(cubeA);
  });

  it('allSidesFilled is true only when every side has a value', () => {
    expect(allSidesFilled(cubeA)).toBe(true);
    expect(allSidesFilled({ ...cubeA, inscriptionId6: '' })).toBe(false);
    expect(allSidesFilled(blank)).toBe(false);
  });
});
