/** The six inscription-id fields of the mint form, in side order. */
export const SIDE_KEYS = [
  'inscriptionId1',
  'inscriptionId2',
  'inscriptionId3',
  'inscriptionId4',
  'inscriptionId5',
  'inscriptionId6',
] as const;

export type SideKey = (typeof SIDE_KEYS)[number];
export type SideValues = Record<SideKey, string>;

/** The six side values out of any object that carries them. */
export function pickSides(form: SideValues): SideValues {
  return {
    inscriptionId1: form.inscriptionId1,
    inscriptionId2: form.inscriptionId2,
    inscriptionId3: form.inscriptionId3,
    inscriptionId4: form.inscriptionId4,
    inscriptionId5: form.inscriptionId5,
    inscriptionId6: form.inscriptionId6,
  };
}

/**
 * May a freshly resolved suggestion overwrite the six sides?
 *
 * Yes when the form is blank (first suggestion after page load), or when
 * the sides are exactly the ones a "Craft another cube" click snapshotted
 * (`craftedFrom`), which means nothing was typed since. Anything else is the
 * user's own input and stays.
 *
 * Keeping the crafted sides in place until their replacement lands, instead
 * of blanking them, is what lets the preview go straight from the old cube
 * to the new one with no empty, placeholder-digit interlude in between.
 */
export function suggestionMayReplace(current: SideValues, craftedFrom: SideValues | null): boolean {
  const anyFilled = SIDE_KEYS.some((k) => current[k]);
  if (!anyFilled) return true;
  return craftedFrom !== null && SIDE_KEYS.every((k) => current[k] === craftedFrom[k]);
}

/** True when every side holds a value: the preview can show a full cube. */
export function allSidesFilled(sides: SideValues): boolean {
  return SIDE_KEYS.every((k) => !!sides[k]);
}
