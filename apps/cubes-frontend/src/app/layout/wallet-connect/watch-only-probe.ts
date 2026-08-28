// Main entry, not `/core`: the genesis CI installs with `--ignore-scripts`,
// so `dist-core/` is never built; the main entry's checked-in dist resolves.
import type { AddressProbe } from 'ordpool-sdk';

// Every CAT-21 cat UTXO is pinned to 546 sats (ordpool-sdk HARD RULE
// "cat UTXO is always 546 sats"), and 546 sats can't fund an inscription
// anyway. electrs can't flag a cat UTXO, so this postage floor is the
// cat/dust proxy that keeps funded/fundedSats to spendable value.
const CAT21_POSTAGE_SATS = 546;

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
 * documented default). For the PAYMENT identity, `funded`/`fundedSats`
 * count only UTXOs above the CAT-21 postage floor, so a cat-bearing address
 * is never auto-picked as the payment source (the AddressProbe contract
 * defines these as spendable, non-cat value).
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
    // Exclude cat-postage / dust UTXOs so a cat-bearing address is not
    // ranked as the best payment identity (AddressProbe.funded/fundedSats
    // are spendable, non-cat value; electrs alone can't tell them apart).
    const spendable = utxos.filter((u) => (u.value ?? 0) > CAT21_POSTAGE_SATS);
    const fundedSats = spendable.reduce((sum, u) => sum + (u.value ?? 0), 0);
    return { funded: spendable.length > 0, fundedSats };
  };
}
