import { UtxoScanState } from 'ordpool-sdk';

/**
 * What a flagged funding coin carries, as display rows.
 *
 * The panel's purpose is to let someone decide whether to spend a coin, so
 * every row carries the identifier that person would recognise, and links to
 * the place that resolves it. A count cannot do that job: "3 inscriptions"
 * reads the same whether they are three throwaway test mints or three things
 * the owner would be sick to lose.
 *
 * Which identifier differs by asset. An inscription is its id, linked to the
 * transaction that created it. A rare sat is its sat number, because rarity
 * and block do not identify it: two sats in one block share both. A cat is the
 * exception that proves the rule: `catIds` holds inscription-id strings rather
 * than the cat NUMBER a holder knows, so listing them would show a row of
 * opaque hex; the count plus a link to the sat page, which names every cat on
 * that sat and shows it, identifies them better than the raw ids would.
 *
 * A rune renders as plain text for the moment: resolving its name to the
 * etching transaction needs the SDK resolver, and the scanner cannot see runes
 * at all until ord-proxy's table parse ships, so the row is unreachable today
 * either way. It gains its link in the same wave as the other two sites.
 */
export interface FundingAssetRow {
  kind: 'inscription' | 'rune' | 'cat' | 'rare-sat';
  /** What the row shows. */
  label: string;
  /** Where it points, or null for plain text. */
  href: string | null;
}

/** The transaction an inscription was created in: its id without the `iN` suffix. */
export function inscriptionTxid(inscriptionId: string): string {
  return inscriptionId.split('i')[0];
}

const TX_BASE = 'https://ordpool.space/tx/';
const SAT_BASE = 'https://cat21.space/sat/';

/**
 * Rows for a coin the scanner flagged. Any other scan state yields none: a
 * coin that is clean, unscanned, still scanning or failed has nothing to list.
 */
export function fundingAssetRows(scan: UtxoScanState | undefined): FundingAssetRow[] {
  if (!scan || scan.kind !== 'scanned-with-assets') return [];
  const { inscriptionIds, runes, catIds, catSat, rareSat } = scan.content;
  const rows: FundingAssetRow[] = [];

  for (const id of inscriptionIds) {
    rows.push({ kind: 'inscription', label: id, href: TX_BASE + inscriptionTxid(id) });
  }

  for (const name of Object.keys(runes ?? {})) {
    rows.push({ kind: 'rune', label: name, href: null });
  }

  if (catIds.length > 0) {
    rows.push({
      kind: 'cat',
      label: `${catIds.length} CAT-21 cat${catIds.length === 1 ? '' : 's'}`,
      href: catSat === null ? null : SAT_BASE + catSat,
    });
  }

  if (rareSat) {
    // The sat NUMBER is what a holder looks up and trades on; rarity and block
    // together do not identify it, since two sats in one block share them.
    rows.push({
      kind: 'rare-sat',
      label: `rare sat: ${rareSat.rarity} · sat ${rareSat.sat} · block ${rareSat.block}`,
      href: null,
    });
  }

  return rows;
}
