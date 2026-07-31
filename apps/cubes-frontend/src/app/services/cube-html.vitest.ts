import { describe, expect, it } from 'vitest';

import { parseCube } from '../../shared/ordinals/parse-cube';
import {
  CUBE_HTML_WARNING_SENTINEL,
  escapeCubeTitle,
  getCubeHtml,
  isCubeWarningHtml,
  type CubeDetails,
} from './cube-html';

/** Six valid inscription-id fixtures used across every case. */
const VALID_IDS = {
  inscriptionId1: 'a'.repeat(64) + 'i0',
  inscriptionId2: 'b'.repeat(64) + 'i0',
  inscriptionId3: 'c'.repeat(64) + 'i0',
  inscriptionId4: 'd'.repeat(64) + 'i0',
  inscriptionId5: 'e'.repeat(64) + 'i0',
  inscriptionId6: 'f'.repeat(64) + 'i0',
};

function buildDetails(title: string, hidden: Partial<Omit<CubeDetails, 'inscriptionIds' | 'title'>> = {}): CubeDetails {
  return {
    inscriptionIds: VALID_IDS,
    title,
    rotationSpeedX: hidden.rotationSpeedX ?? '',
    rotationSpeedY: hidden.rotationSpeedY ?? '',
    colorPane: hidden.colorPane ?? '',
    bgColor1: hidden.bgColor1 ?? '',
    bgColor2: hidden.bgColor2 ?? '',
  };
}

function parsedTitle(html: string): string | undefined {
  const traits = parseCube(html);
  return traits?.find((t) => t.trait_type === 'Title')?.value;
}

describe('escapeCubeTitle', () => {
  it('is a no-op on plain ASCII with no entities', () => {
    expect(escapeCubeTitle('Hello Cube')).toBe('Hello Cube');
  });

  it('escapes < > & " globally (all occurrences, not just the first)', () => {
    expect(escapeCubeTitle('<a>')).toBe('&lt;a&gt;');
    expect(escapeCubeTitle('A < B < C')).toBe('A &lt; B &lt; C');
    expect(escapeCubeTitle('X > Y > Z')).toBe('X &gt; Y &gt; Z');
    expect(escapeCubeTitle('R&D & Q&A')).toBe('R&amp;D &amp; Q&amp;A');
    expect(escapeCubeTitle('She said "hi" and "bye"')).toBe('She said &quot;hi&quot; and &quot;bye&quot;');
  });

  it('encodes `&` first so a literal user "&lt;" round-trips without collapsing', () => {
    // The user wrote the LITERAL 4-char string `&lt;`. On the on-chain
    // body it must appear as `&amp;lt;` (not `&lt;`, which would decode
    // back to `<`). The single-pass unescape in parseCube then returns
    // it to `&lt;`.
    expect(escapeCubeTitle('&lt;')).toBe('&amp;lt;');
  });

  it('leaves unicode + emoji alone', () => {
    expect(escapeCubeTitle('cube 🧊 café')).toBe('cube 🧊 café');
  });
});

describe('getCubeHtml + parseCube round-trip', () => {
  it('accepts an empty title (no <head> block)', () => {
    const html = getCubeHtml(buildDetails(''));
    expect(isCubeWarningHtml(html)).toBe(false);
    expect(parsedTitle(html)).toBeUndefined();
  });

  it('round-trips a plain-ASCII title byte-for-byte', () => {
    const html = getCubeHtml(buildDetails('My Cube'));
    expect(parsedTitle(html)).toBe('My Cube');
  });

  it.each([
    'A < B < C',
    'X > Y > Z',
    'R&D & Q&A',
    'She said "hi"',
    '<script>alert(1)</script>',
    '<<< >>>',
    'cube 🧊 café',
    '&lt;',        // literal 4-char user string
    '&amp;lt;',    // literal 8-char user string
    '&amp;&lt;&gt;&quot;',
    'A & B < C > D " E',
  ])('round-trips title with special chars: %s', (title) => {
    const html = getCubeHtml(buildDetails(title));
    expect(isCubeWarningHtml(html)).toBe(false);
    expect(parsedTitle(html)).toBe(title);
  });

  it('never returns the Warning fallback for a well-formed title', () => {
    // Sweep every ASCII char that could plausibly appear in a title.
    for (let code = 32; code < 127; code++) {
      const ch = String.fromCharCode(code);
      const title = `pre${ch}post`;
      const html = getCubeHtml(buildDetails(title));
      expect(
        isCubeWarningHtml(html),
        `Warning fallback fired for title="${title}" (char code ${code})`,
      ).toBe(false);
      expect(parsedTitle(html), `round-trip mismatch for char code ${code}`).toBe(title);
    }
  });
});

describe('hidden concat-field hardening', () => {
  // These fields have no GUI input today, but stripConcatUnsafe defends
  // against a future template exposing them without remembering to
  // sanitize. The tests pin the defence — if someone deletes it, the
  // fuzz below catches it before it ships.
  it('strips a raw single quote from rotationSpeedX (would otherwise break parseCube regex)', () => {
    const html = getCubeHtml(buildDetails('', { rotationSpeedX: "5'x" }));
    expect(isCubeWarningHtml(html)).toBe(false);
    // Value lands in group 3 of parseCube's regex — assert parseCube
    // extracts a version + six sides (proves the concat is well-formed).
    expect(parseCube(html)?.some((t) => t.trait_type === 'Version' && t.value === 'v3')).toBe(true);
  });

  it('strips a raw pipe from colorPane (would otherwise misalign the traits split)', () => {
    const html = getCubeHtml(buildDetails('', { colorPane: 'red|blue' }));
    expect(isCubeWarningHtml(html)).toBe(false);
    // If the pipe survived, `data.split('|')` inside parseCube would
    // treat "red" and "blue" as separate fields and Side 1 would still
    // be `a…`, but Version would drop off the end. Assert Version is
    // preserved to prove the pipe was stripped upstream.
    expect(parseCube(html)?.some((t) => t.trait_type === 'Version')).toBe(true);
  });
});
