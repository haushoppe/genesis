import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeElectrsUtxoProbe } from './watch-only-probe';

/**
 * Pins the consumer-owned electrs I/O the watch-only scan depends on:
 * the exact URL shape (matching Cat21Service.getUtxos) and the
 * funded/fundedSats reduction the SDK's auto-pick ranks on.
 */
describe('makeElectrsUtxoProbe', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('counts only spendable UTXOs above the cat-postage floor, and hits the electrs utxo URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      // 1000 = spendable; 546 = CAT-21 postage (a bonus cat), must be excluded.
      json: async () => [{ value: 1000 }, { value: 546 }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const probe = makeElectrsUtxoProbe('https://api.example.test');
    const result = await probe('bc1pexample');

    expect(result).toEqual({ funded: true, fundedSats: 1000 });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/address/bc1pexample/utxo');
  });

  it('reports an address holding only cat-postage / dust UTXOs as not funded', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ value: 546 }, { value: 330 }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const probe = makeElectrsUtxoProbe('https://api.example.test');
    const result = await probe('bc1ponlycats');

    expect(result).toEqual({ funded: false, fundedSats: 0 });
  });

  it('builds a same-origin URL for the regtest empty base', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    const probe = makeElectrsUtxoProbe('');
    const result = await probe('bcrt1pempty');

    expect(result).toEqual({ funded: false, fundedSats: 0 });
    expect(fetchMock).toHaveBeenCalledWith('/api/address/bcrt1pempty/utxo');
  });

  it('throws a clear error on a non-ok electrs response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => [] }));

    const probe = makeElectrsUtxoProbe('https://api.example.test');

    await expect(probe('bc1pboom')).rejects.toThrow('HTTP 503');
  });
});
