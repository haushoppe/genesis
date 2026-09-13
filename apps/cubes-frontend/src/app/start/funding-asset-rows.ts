import { UtxoScanState } from 'ordpool-sdk';

/**
 * What a flagged funding coin carries, as display rows.
 *
 * The panel's purpose is to let someone decide whether to spend a coin, and a
 * count cannot answer that: "3 inscriptions" reads the same whether they are
 * three throwaway test mints or three things the owner would be sick to lose.
 * So an inscription appears by its own id and links to the transaction that
 * created it. Cats stay a count with a link to the sat they ride, because that
 * is the page that shows every cat on it and where it sits now, and because
 * the other two family sites already link exactly there.
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
    rows.push({ kind: 'rare-sat', label: `${rareSat.rarity} sat (block ${rareSat.block})`, href: null });
  }

  return rows;
}
