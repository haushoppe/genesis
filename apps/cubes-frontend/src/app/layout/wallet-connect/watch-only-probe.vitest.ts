import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeElectrsUtxoProbe } from './watch-only-probe';

/**
 * Pins the consumer-owned electrs + cat21-ord I/O the watch-only scan
 * depends on: the URL shapes, the cat21-ord `cats`-based exclusion of the
 * payment identity, `hasCat`, and the 546-sat postage-floor fallback.
 */
describe('makeElectrsUtxoProbe', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  // Routes electrs `/api/address/:a/utxo` and cat21-ord `/output/:outpoint`
  // to fixtures. `catOutpoints` is the set of "txid:vout" that hold a cat.
  const routedFetch = (utxos: unknown[], catOutpoints: Set<string> = new Set()) =>
    vi.fn((url: string) => {
      if (url.includes('/api/address/')) {
        return Promise.resolve({ ok: true, json: async () => utxos });
      }
      const outpoint = url.split('/output/')[1];
      return Promise.resolve({ ok: true, json: async () => ({ cats: catOutpoints.has(outpoint) ? ['a-cat'] : [] }) });
    });

  const A = 'a'.repeat(64);
  const B = 'b'.repeat(64);

  it('drops cat-bearing UTXOs from funded/fundedSats and sets hasCat (cat21-ord path)', async () => {
    const utxos = [{ txid: A, vout: 0, value: 10_000 }, { txid: B, vout: 1, value: 546 }];
    vi.stubGlobal('fetch', routedFetch(utxos, new Set([`${B}:1`])));

    const probe = makeElectrsUtxoProbe('https://api.example.test', 'https://ord.example.test');
    expect(await probe('bc1pexample')).toEqual({ funded: true, fundedSats: 10_000, hasCat: true });
  });

  it('reports an address holding only a cat as not funded (cat21-ord path)', async () => {
    vi.stubGlobal('fetch', routedFetch([{ txid: A, vout: 0, value: 100_000 }], new Set([`${A}:0`])));

    const probe = makeElectrsUtxoProbe('https://api.example.test', 'https://ord.example.test');
    expect(await probe('bc1ponlycat')).toEqual({ funded: false, fundedSats: 0, hasCat: true });
  });

  it('hits the exact electrs utxo URL', async () => {
    const fetchMock = routedFetch([]);
    vi.stubGlobal('fetch', fetchMock);

    await makeElectrsUtxoProbe('https://api.example.test', 'https://ord.example.test')('bc1pexample');
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/address/bc1pexample/utxo');
  });

  it('degrades to the 546-sat postage floor when a cat21-ord lookup fails', async () => {
    const utxos = [{ txid: A, vout: 0, value: 5000 }, { txid: B, vout: 1, value: 546 }];
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      url.includes('/api/address/')
        ? Promise.resolve({ ok: true, json: async () => utxos })
        : Promise.resolve({ ok: false, status: 503, json: async () => ({}) })));

    const probe = makeElectrsUtxoProbe('https://api.example.test', 'https://ord.example.test');
    // 5000 kept (> floor), 546 dropped (== floor); hasCat reflects the floor determination.
    expect(await probe('bc1pexample')).toEqual({ funded: true, fundedSats: 5000, hasCat: true });
  });

  it('falls back to the postage floor with no hasCat when no cat21-ord is configured', async () => {
    const fetchMock = routedFetch([{ txid: A, vout: 0, value: 1000 }, { txid: B, vout: 1, value: 546 }]);
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeElectrsUtxoProbe('https://api.example.test', '')('bc1pexample');
    expect(result).toEqual({ funded: true, fundedSats: 1000 });  // 546 excluded, hasCat unset
    expect(fetchMock).toHaveBeenCalledTimes(1);                  // no cat21-ord call
  });

  it('builds a same-origin URL for the regtest empty base', async () => {
    const fetchMock = routedFetch([]);
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeElectrsUtxoProbe('', '')('bcrt1pempty');
    expect(result).toEqual({ funded: false, fundedSats: 0 });
    expect(fetchMock).toHaveBeenCalledWith('/api/address/bcrt1pempty/utxo');
  });

  it('throws a clear error on a non-ok electrs response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => [] }));

    const probe = makeElectrsUtxoProbe('https://api.example.test', 'https://ord.example.test');
    await expect(probe('bc1pboom')).rejects.toThrow('HTTP 503');
  });
});
