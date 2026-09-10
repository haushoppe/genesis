import { nextMintTxStatus } from './mint-status.service';

describe('nextMintTxStatus', () => {
  it('returns null for a 404 / error so a shown status is not regressed', () => {
    expect(nextMintTxStatus(null)).toBeNull();
  });

  it('maps an unconfirmed tx to mempool', () => {
    expect(nextMintTxStatus({ status: { confirmed: false } })).toEqual({ state: 'mempool' });
  });

  it('maps a tx with no status object to mempool (seen, not yet confirmed)', () => {
    expect(nextMintTxStatus({})).toEqual({ state: 'mempool' });
  });

  it('maps a confirmed tx to confirmed with its block height', () => {
    expect(nextMintTxStatus({ status: { confirmed: true, block_height: 840123 } }))
      .toEqual({ state: 'confirmed', blockHeight: 840123 });
  });
});
