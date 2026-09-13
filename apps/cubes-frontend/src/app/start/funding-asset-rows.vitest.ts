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

  it('names a rune, without a link for now', () => {
    const rows = fundingAssetRows(withAssets({ runes: { 'UNCOMMON•GOODS': { amount: '5' } } }));
    expect(rows).toEqual([{ kind: 'rune', label: 'UNCOMMON•GOODS', href: null }]);
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
