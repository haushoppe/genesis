import { describe, expect, it } from 'vitest';

import { blackFacesLabel, CHROME_CURSE_LABEL, chromeCurseExplanation, curseLabel, facesLabel } from './rarity-labels';

describe('facesLabel', () => {
  it('reads naturally for one, two and more faces', () => {
    expect(facesLabel([2])).toBe('face 2');
    expect(facesLabel([2, 5])).toBe('faces 2 and 5');
    expect(facesLabel([1, 2, 6])).toBe('faces 1, 2 and 6');
  });
});

describe('curseLabel', () => {
  it('names each reason with the faces it concerns', () => {
    expect(curseLabel({ cursed: ['black-side'], blackSides: [3], reusedSides: [] })).toBe('face 3 is black');
    expect(curseLabel({ cursed: ['black-side'], blackSides: [2, 3, 4, 5, 6], reusedSides: [] })).toBe('faces 2, 3, 4, 5 and 6 are black');
    expect(curseLabel({ cursed: ['reused-inscription'], blackSides: [], reusedSides: [1] })).toBe('face 1 was claimed by an earlier cube');
    expect(curseLabel({ cursed: ['duplicate-side'], blackSides: [], reusedSides: [] })).toBe('two faces show the same inscription');
  });

  it('joins several reasons in the order the index lists them', () => {
    expect(curseLabel({ cursed: ['duplicate-side', 'black-side', 'reused-inscription'], blackSides: [6], reusedSides: [1, 2] }))
      .toBe('two faces show the same inscription; face 6 is black; faces 1 and 2 were claimed by an earlier cube');
  });
});

describe('chromeCurseExplanation', () => {
  it('names the faces and says these cubes used to render', () => {
    const one = chromeCurseExplanation([2]);
    expect(one).toContain('Face 2 is an SVG without a fixed size');
    expect(one).toContain('rendered when they were minted');
    expect(chromeCurseExplanation([2, 5])).toContain('Faces 2 and 5 are');
  });

  it('says "every side" when the whole cube is affected', () => {
    expect(chromeCurseExplanation([1, 2, 3, 4, 5, 6])).toContain('Every side of this cube is');
  });

  it('carries the badge wording', () => {
    expect(CHROME_CURSE_LABEL).toBe('Cursed | Chrome f*cked us');
  });
});

describe('blackFacesLabel', () => {
  it('is null without black faces and a full sentence otherwise', () => {
    expect(blackFacesLabel([])).toBeNull();
    expect(blackFacesLabel([2])).toBe('Side 2 does not render as an image');
    expect(blackFacesLabel([2, 5])).toBe('Sides 2 and 5 do not render as images');
  });
});
