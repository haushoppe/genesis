import { describe, expect, it } from 'vitest';
import { UtxoScanState } from 'ordpool-sdk';

import { assetDetailRows, fundingAssetRows, inscriptionTxid } from './funding-asset-rows';

const TXID = 'a'.repeat(64);
const INSCRIPTION = `${TXID}i0`;

function withAssets(content: Partial<Extract<UtxoScanState, { kind: 'scanned-with-assets' }>['content']>): UtxoScanState {
  return {
    kind: 'scanned-with-assets',
    content: {
      outpoint: `${TXID}:0`,
      inscriptionIds: [],
      runes: null,
      catIds: [],
      catSat: null,
      rareSat: null,
      ...content,
    },
  } as UtxoScanState;
}

describe('inscriptionTxid', () => {
  it('drops the index suffix, so the link points at the creating transaction', () => {
    expect(inscriptionTxid(INSCRIPTION)).toBe(TXID);
    expect(inscriptionTxid(`${TXID}i12`)).toBe(TXID);
  });
});

describe('fundingAssetRows', () => {
  it('lists an inscription by its own id and links its transaction', () => {
    expect(fundingAssetRows(withAssets({ inscriptionIds: [INSCRIPTION] }))).toEqual([
      { kind: 'inscription', label: INSCRIPTION, href: `https://ordpool.space/tx/${TXID}` },
    ]);
  });

  it('lists every inscription, never a count', () => {
    const rows = fundingAssetRows(withAssets({ inscriptionIds: [INSCRIPTION, `${TXID}i1`] }));
    expect(rows.map((r) => r.label)).toEqual([INSCRIPTION, `${TXID}i1`]);
  });

  it('links cats to the sat they ride, and says how many', () => {
    expect(fundingAssetRows(withAssets({ catIds: [INSCRIPTION], catSat: 1971987 }))).toEqual([
      { kind: 'cat', label: '1 CAT-21 cat', href: 'https://cat21.space/sat/1971987' },
    ]);
    const two = fundingAssetRows(withAssets({ catIds: [INSCRIPTION, `${TXID}i1`], catSat: 5 }));
    expect(two[0].label).toBe('2 CAT-21 cats');
  });

  it('still reports cats when their sat is unknown, without a link', () => {
    const rows = fundingAssetRows(withAssets({ catIds: [INSCRIPTION], catSat: null }));
    expect(rows[0]).toEqual({ kind: 'cat', label: '1 CAT-21 cat', href: null });
  });

  describe('runes', () => {
    // ord serialises a pile's amount as a bare JSON number, so this is the
    // shape that actually arrives. Measured on ord.ordpool.space:
    // "runes":{"ANARCHY":{"amount":12600000,"divisibility":0,"symbol":"⬛"}}
    const ANARCHY = { amount: 12600000, divisibility: 0, symbol: '⬛' };

    it('renders the balance as ord does, and names the rune', () => {
      const rows = fundingAssetRows(withAssets({ runes: { ANARCHY } }));
      // U+00A0 written as an escape: ord's separator is invisible in source.
      expect(rows).toEqual([{ kind: 'rune', label: '12600000 ⬛ ANARCHY', href: null }]);
    });

    it('divides by the divisibility and drops a zero fraction, as ord does', () => {
      const rows = fundingAssetRows(
        withAssets({ runes: { 'DOG•GO•TO•THE•MOON': { amount: 250000, divisibility: 5, symbol: '🐕' } } }),
      );
      expect(rows[0].label).toBe('2.5 🐕 DOG•GO•TO•THE•MOON');
    });

    it('writes every digit of an amount past the safe-integer range', () => {
      // String(1e21) is "1e+21"; the digits have to come out in full or the
      // SDK rejects the value and the amount silently disappears.
      const rows = fundingAssetRows(withAssets({ runes: { BIG: { amount: 1e21, divisibility: 0, symbol: 'X' } } }));
      expect(rows[0].label).toBe('1000000000000000000000 X BIG');
    });

    it('falls back to the currency sign when a rune has no symbol', () => {
      const rows = fundingAssetRows(withAssets({ runes: { PLAIN: { amount: 7, divisibility: 0, symbol: null } } }));
      expect(rows[0].label).toBe('7 ¤ PLAIN');
    });

    it('links a rune to the transaction that etched it', () => {
      const rows = fundingAssetRows(withAssets({ runes: { ANARCHY } }), new Map([['ANARCHY', TXID]]));
      expect(rows[0].href).toBe(`https://ordpool.space/tx/${TXID}`);
    });

    it('leaves a rune unlinked while its etching is unresolved', () => {
      const rows = fundingAssetRows(withAssets({ runes: { ANARCHY } }), new Map([['SOMETHING•ELSE', TXID]]));
      expect(rows[0].href).toBeNull();
    });

    it('shows the bare name rather than throwing on a value it cannot read', () => {
      for (const value of [null, 'just a string', {}, { amount: 5 }, { amount: 'x', divisibility: 0 }, { amount: 5, divisibility: 99 }]) {
        const rows = fundingAssetRows(withAssets({ runes: { ODD: value } }));
        expect(rows[0]).toEqual({ kind: 'rune', label: 'ODD', href: null });
      }
    });
  });

  it('names a rare sat by its sat number and links it to the sat page', () => {
    const rows = fundingAssetRows(withAssets({ rareSat: { sat: '1971987', block: 5, rarity: 'uncommon' } as never }));
    // Two sats in one block share rarity and block, so the number is the
    // identity, and the sat page is where a reader resolves it.
    expect(rows).toEqual([
      {
        kind: 'rare-sat',
        label: 'rare sat: uncommon · sat 1971987 · block 5',
        href: 'https://cat21.space/sat/1971987',
      },
    ]);
  });

  it('keeps every kind on one coin, inscriptions first', () => {
    const rows = fundingAssetRows(withAssets({
      inscriptionIds: [INSCRIPTION],
      runes: { RUNE: {} },
      catIds: [INSCRIPTION],
      catSat: 7,
      rareSat: { sat: '1', block: 1, rarity: 'epic' } as never,
    }));
    expect(rows.map((r) => r.kind)).toEqual(['inscription', 'rune', 'cat', 'rare-sat']);
  });

  it('lists nothing for a coin that is not flagged', () => {
    expect(fundingAssetRows({ kind: 'scanned-clean' })).toEqual([]);
    expect(fundingAssetRows({ kind: 'not-scanned' })).toEqual([]);
    expect(fundingAssetRows({ kind: 'scanning' })).toEqual([]);
    expect(fundingAssetRows({ kind: 'scan-failed', message: 'x' })).toEqual([]);
    expect(fundingAssetRows(undefined)).toEqual([]);
  });
});

/**
 * A cat is named by its cat number wherever the scan found one, and keeps the
 * display that works without a number where it did not. Both functions are
 * pinned, because the picker reads the scan state and the notice reads the
 * SDK's annotated detail: two sources, one fallback, the count on the sat
 * link, so a notice and the picker row show the same link.
 */
describe('cats by number', () => {
  const CAT_A = `${TXID}i0`;
  const CAT_B = `${'b'.repeat(64)}i0`;

  describe('in the picker (the scan state)', () => {
    it('names each numbered cat and links its cat page', () => {
      const rows = fundingAssetRows(withAssets({
        catIds: [CAT_A, CAT_B],
        cats: [{ id: CAT_A, number: 1234 }, { id: CAT_B, number: 0 }],
        catSat: 5,
      }));
      // Cat #0 is the Genesis Cat: a falsy number is still a number.
      expect(rows).toEqual([
        { kind: 'cat', label: 'Cat #1234', href: 'https://cat21.space/cat/1234' },
        { kind: 'cat', label: 'Cat #0', href: 'https://cat21.space/cat/0' },
      ]);
    });

    it('counts the cats whose number the lookup did not return, on the sat link', () => {
      const rows = fundingAssetRows(withAssets({
        catIds: [CAT_A, CAT_B],
        cats: [{ id: CAT_A, number: 1234 }, { id: CAT_B, number: null }],
        catSat: 1971987,
      }));
      expect(rows).toEqual([
        { kind: 'cat', label: 'Cat #1234', href: 'https://cat21.space/cat/1234' },
        { kind: 'cat', label: '1 CAT-21 cat', href: 'https://cat21.space/sat/1971987' },
      ]);
    });

    it('keeps the count on the sat link when the scan carries no numbers at all', () => {
      expect(fundingAssetRows(withAssets({ catIds: [CAT_A], catSat: 1971987 }))).toEqual([
        { kind: 'cat', label: '1 CAT-21 cat', href: 'https://cat21.space/sat/1971987' },
      ]);
    });
  });

  describe('in the notice (the annotated asset detail)', () => {
    const detail = (cats?: { id: string; number: number | null }[], catSat?: number | null) => ({
      inscriptionIds: [], runeNames: [], catIds: [CAT_A, CAT_B], rareSat: null,
      ...(cats ? { cats } : {}), ...(catSat !== undefined ? { catSat } : {}),
    });

    it('names each numbered cat and links its cat page', () => {
      expect(assetDetailRows(detail([{ id: CAT_A, number: 1234 }, { id: CAT_B, number: 21 }]))).toEqual([
        { kind: 'cat', label: 'Cat #1234', href: 'https://cat21.space/cat/1234' },
        { kind: 'cat', label: 'Cat #21', href: 'https://cat21.space/cat/21' },
      ]);
    });

    it('counts the cats whose number the lookup did not return, on the sat link', () => {
      expect(assetDetailRows(detail([{ id: CAT_A, number: null }, { id: CAT_B, number: 21 }], 1971987))).toEqual([
        { kind: 'cat', label: 'Cat #21', href: 'https://cat21.space/cat/21' },
        { kind: 'cat', label: '1 CAT-21 cat', href: 'https://cat21.space/sat/1971987' },
      ]);
      expect(assetDetailRows(detail(undefined, 1971987))).toEqual([
        { kind: 'cat', label: '2 CAT-21 cats', href: 'https://cat21.space/sat/1971987' },
      ]);
    });

    it('keeps the count as plain text when the detail names no sat', () => {
      // null: no sat ranges. Absent: a scan port that does not report it.
      for (const catSat of [null, undefined]) {
        expect(assetDetailRows(detail([{ id: CAT_A, number: null }, { id: CAT_B, number: null }], catSat))).toEqual([
          { kind: 'cat', label: '2 CAT-21 cats', href: null },
        ]);
      }
    });
  });
});
