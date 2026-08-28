import { describe, expect, it } from 'vitest';
import { CUBES_GENESIS_UTC, wholeYearsSince, yearsOnChainLabel } from './years-on-chain';

describe('wholeYearsSince (anchor = cubes genesis, 23 June 2023 13:33 UTC)', () => {
  const at = (iso: string) => Date.parse(iso);

  it('is 0 before the first anniversary', () => {
    expect(wholeYearsSince(CUBES_GENESIS_UTC, at('2024-06-22T00:00:00Z'))).toBe(0);
  });

  it('ticks to 1 on the anniversary day, not on 1 January', () => {
    expect(wholeYearsSince(CUBES_GENESIS_UTC, at('2024-01-01T00:00:00Z'))).toBe(0);
    expect(wholeYearsSince(CUBES_GENESIS_UTC, at('2024-06-23T13:33:00Z'))).toBe(1);
  });

  it('is 3 in late August 2026 (the third year is under way)', () => {
    expect(wholeYearsSince(CUBES_GENESIS_UTC, at('2026-08-28T00:00:00Z'))).toBe(3);
  });

  it('is still 2 the minute before the third anniversary', () => {
    expect(wholeYearsSince(CUBES_GENESIS_UTC, at('2026-06-23T13:32:00Z'))).toBe(2);
  });
});

describe('yearsOnChainLabel', () => {
  const at = (iso: string) => Date.parse(iso);

  it('renders a capitalized cardinal word', () => {
    expect(yearsOnChainLabel(at('2025-07-01T00:00:00Z'))).toBe('Two');
    expect(yearsOnChainLabel(at('2026-08-28T00:00:00Z'))).toBe('Three');
  });

  it('falls back to digits past the word list', () => {
    expect(yearsOnChainLabel(at('2044-07-01T00:00:00Z'))).toBe('21');
  });
});
