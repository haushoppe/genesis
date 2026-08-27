import type { AddressProbe } from 'ordpool-sdk/core';

/**
 * Builds the `probe` callback `WalletService.connectXpub` / `scanWatchOnly`
 * require. The SDK owns derive + rank; the consumer owns the on-chain I/O.
 *
 * Each derived receive address is looked up on electrs at the exact URL the
 * rest of the mint flow uses for UTXOs (`Cat21Service.getUtxos` hits
 * `${mempoolApiUrl}/api/address/:a/utxo`), so a watch-only wallet's payment
 * identity is picked from the same UTXO set the inscribe flow later spends.
 *
 * `hasCat` is deliberately omitted: cubes inscribes, it does not read cats,
 * so the scan's ordinals identity falls back to receive index 0 (the SDK's
 * documented default) while the payment identity is the highest-funded
 * address in the scanned window.
 */
export function makeElectrsUtxoProbe(
  mempoolApiUrl: string,
): (address: string) => Promise<AddressProbe> {
  return async (address: string): Promise<AddressProbe> => {
    const res = await fetch(`${mempoolApiUrl}/api/address/${address}/utxo`);
    if (!res.ok) {
      throw new Error(`Watch-only scan: electrs returned HTTP ${res.status} for ${address}`);
    }
    const utxos = (await res.json()) as ReadonlyArray<{ value: number }>;
    const fundedSats = utxos.reduce((sum, u) => sum + (u.value ?? 0), 0);
    return { funded: utxos.length > 0, fundedSats };
  };
}
