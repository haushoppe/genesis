/**
 * The cubes went on-chain at block 795579, 23 June 2023 13:33 UTC. The
 * landing copy's "N years on-chain and counting" line derives N from this
 * anchor so it ticks over on its own each 23 June, instead of rotting as a
 * hardcoded word. `Date.UTC` months are 0-based, so 5 = June.
 */
export const CUBES_GENESIS_UTC = Date.UTC(2023, 5, 23, 13, 33);

const CARDINALS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
];

/**
 * Whole years between `anchorMs` and `nowMs`, UTC anniversary-aware: the
 * count only ticks up once the day-of-year is reached, not on 1 January.
 * `nowMs` is injectable so it can be pinned in tests.
 */
export function wholeYearsSince(anchorMs: number, nowMs: number = Date.now()): number {
  const anchor = new Date(anchorMs);
  const now = new Date(nowMs);
  let years = now.getUTCFullYear() - anchor.getUTCFullYear();
  const anniversaryThisYear = Date.UTC(
    now.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(),
    anchor.getUTCHours(), anchor.getUTCMinutes(),
  );
  if (nowMs < anniversaryThisYear) years -= 1;
  return years;
}

/**
 * The cubes' years-on-chain as a capitalized cardinal word for the landing
 * copy ("Two", "Three", …). Falls back to digits past the word list.
 */
export function yearsOnChainLabel(nowMs: number = Date.now()): string {
  const n = wholeYearsSince(CUBES_GENESIS_UTC, nowMs);
  const word = n >= 0 && n < CARDINALS.length ? CARDINALS[n] : String(n);
  return word.charAt(0).toUpperCase() + word.slice(1);
}
