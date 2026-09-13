import { describe, expect, it } from 'vitest';
import { UtxoScanState } from 'ordpool-sdk';

import { fundingAssetRows, inscriptionTxid } from './funding-asset-rows';

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

  it('names a rare sat by its sat number, not only its rarity and block', () => {
    const rows = fundingAssetRows(withAssets({ rareSat: { sat: '1971987', block: 5, rarity: 'uncommon' } as never }));
    // Two sats in one block share rarity and block, so the number is the identity.
    expect(rows).toEqual([
      { kind: 'rare-sat', label: 'rare sat: uncommon · sat 1971987 · block 5', href: null },
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
