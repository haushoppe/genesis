// Main entry, not `/core`: the genesis CI installs with `--ignore-scripts`,
// so `dist-core/` is never built; the main entry's checked-in dist resolves.
import type { AddressProbe } from 'ordpool-sdk';

// The CAT-21 postage every cat UTXO is pinned to (ordpool-sdk HARD RULE
// "cat UTXO is always 546 sats"), and 546 sats can't fund an inscription
// anyway. Used only as a FALLBACK cat/dust proxy when no cat21-ord instance
// is configured (regtest) or a per-output lookup fails.
const CAT21_POSTAGE_SATS = 546;

interface ElectrsUtxo {
  txid: string;
  vout: number;
  value: number;
}

/**
 * Builds the `probe` callback `WalletService.connectXpub` / `scanWatchOnly`
 * require. The SDK owns derive + rank; the consumer owns the on-chain I/O.
 *
 * UTXO values come from electrs (`${mempoolApiUrl}/api/address/:a/utxo`, the
 * exact URL the mint flow spends from). Cat membership comes from cat21-ord,
 * our authoritative CAT-21 index: `${cat21OrdApiUrl}/output/<txid>:<vout>`
 * returns a `cats` array. Cat-bearing UTXOs are dropped from
 * `funded`/`fundedSats` (the AddressProbe contract's spendable, non-cat
 * value) so `scanWatchOnly` never ranks a cat-only address as the payment
 * identity, and `hasCat` is set so the ordinals identity lands on the
 * address that already holds cats.
 *
 * When `cat21OrdApiUrl` is empty (regtest / unconfigured) or a per-output
 * lookup fails, it falls back to excluding the 546-sat CAT-21 postage as a
 * cat/dust proxy.
 */
export function makeElectrsUtxoProbe(
  mempoolApiUrl: string,
  cat21OrdApiUrl: string,
): (address: string) => Promise<AddressProbe> {
  return async (address: string): Promise<AddressProbe> => {
    const res = await fetch(`${mempoolApiUrl}/api/address/${address}/utxo`);
    if (!res.ok) {
      throw new Error(`Watch-only scan: electrs returned HTTP ${res.status} for ${address}`);
    }
    const utxos = (await res.json()) as ReadonlyArray<ElectrsUtxo>;
    if (utxos.length === 0) return { funded: false, fundedSats: 0 };

    // No cat21-ord configured: heuristic floor only, and no cat truth to
    // report (leave hasCat unset so the ordinals identity falls back to
    // receive index 0, the SDK's documented default).
    if (!cat21OrdApiUrl) {
      const spendable = utxos.filter((u) => (u.value ?? 0) > CAT21_POSTAGE_SATS);
      return { funded: spendable.length > 0, fundedSats: sumSats(spendable) };
    }

    const holdsCat = await Promise.all(utxos.map((u) => outputHoldsCat(cat21OrdApiUrl, u)));
    const spendable = utxos.filter((_, i) => !holdsCat[i]);
    return {
      funded: spendable.length > 0,
      fundedSats: sumSats(spendable),
      hasCat: holdsCat.some(Boolean),
    };
  };
}

function sumSats(utxos: ReadonlyArray<ElectrsUtxo>): number {
  return utxos.reduce((total, u) => total + (u.value ?? 0), 0);
}

/**
 * True if the outpoint currently holds a CAT-21 cat, per cat21-ord's
 * `cats` array. A failed lookup degrades to the 546-sat postage floor for
 * that UTXO, so a transient cat21-ord hiccup can't wrongly rank a cat as
 * spendable (a cat is 546 sats, which the floor already excludes).
 */
async function outputHoldsCat(cat21OrdApiUrl: string, utxo: ElectrsUtxo): Promise<boolean> {
  try {
    const res = await fetch(`${cat21OrdApiUrl}/output/${utxo.txid}:${utxo.vout}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const out = (await res.json()) as { cats?: unknown[] };
      return (out.cats?.length ?? 0) > 0;
    }
  } catch {
    // fall through to the postage floor
  }
  return (utxo.value ?? 0) <= CAT21_POSTAGE_SATS;
}
