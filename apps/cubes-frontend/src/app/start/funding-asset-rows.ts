import { CatOnOutpoint, formatRunePile, UtxoScanState } from 'ordpool-sdk';

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
 * and block do not identify it: two sats in one block share both. A cat is its
 * cat NUMBER, the one a holder knows ("Cat #1234"), linked to its cat page.
 * The scan looks the number up per cat and can come back without one; such
 * cats are counted on one row linked to the sat they ride, on the picker and
 * the notice alike, so a failed lookup costs the reader a nicer label, never
 * the fact that a cat is on the coin.
 *
 * A rune is its balance rendered the way ord renders it, linked to the
 * transaction that etched it. The etching is not in the scan, so the caller
 * resolves the names it sees and passes them in; a name with no answer yet,
 * or none to be had, is simply not in the map and its row stays plain text.
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
const CAT_BASE = 'https://cat21.space/cat/';

/** A cat named by its number, linked to its own page. */
function catRow(number: number): FundingAssetRow {
  return { kind: 'cat', label: `Cat #${number}`, href: CAT_BASE + number };
}

/** The number the scan found for this cat, or null when it has none. */
function numberOf(cats: readonly CatOnOutpoint[] | undefined, id: string): number | null {
  return cats?.find((c) => c.id === id)?.number ?? null;
}

/**
 * The cat rows for one coin. Each cat with a number is its own row. Those
 * without one are counted on a single row linked to the sat page, which names
 * every cat on that sat: CAT-21 pins a coin's cats to its first sat, so one
 * link covers them all. With the sat unknown (`null`, or a scan port that does
 * not report it) the count stays plain text.
 */
function catRows(
  catIds: readonly string[],
  cats: readonly CatOnOutpoint[] | undefined,
  catSat: number | null | undefined,
): FundingAssetRow[] {
  const rows: FundingAssetRow[] = [];
  let unnumbered = 0;
  for (const id of catIds) {
    const number = numberOf(cats, id);
    if (number === null) unnumbered++;
    else rows.push(catRow(number));
  }
  if (unnumbered > 0) {
    rows.push({
      kind: 'cat',
      label: `${unnumbered} CAT-21 cat${unnumbered === 1 ? '' : 's'}`,
      href: catSat === null || catSat === undefined ? null : SAT_BASE + catSat,
    });
  }
  return rows;
}

/**
 * One rune's row text: its balance as ord renders it, then the name.
 *
 * The value is typed `unknown` by the SDK because it is whatever ord put
 * there, so the shape is checked here rather than trusted. ord serialises a
 * pile's amount as a bare JSON NUMBER, so that is the case to expect after
 * `JSON.parse`; a string or a bigint is accepted too, for a caller that got
 * the digits out some other way.
 *
 * A value that does not match falls back to the bare name. `formatRuneAmount`
 * throws on a divisibility it cannot use, and a throw while someone is deciding
 * whether to spend a coin would take the whole panel down over a cosmetic
 * detail; the name alone still tells them what is on the coin.
 *
 * The bound worth knowing: a rune amount is a u128, and the ones that exceed
 * `Number.MAX_SAFE_INTEGER` have already lost their last digits inside
 * `JSON.parse`, before any code here runs. Nothing downstream can recover
 * them, and for a "do not burn this" panel it does not change the decision.
 */
function runeLabel(name: string, value: unknown): string {
  if (typeof value !== 'object' || value === null) return name;
  const { amount, divisibility, symbol } = value as {
    amount?: unknown;
    divisibility?: unknown;
    symbol?: unknown;
  };

  // Integer-valued numbers go through BigInt, which writes out every digit.
  // String(1e21) is "1e+21", which the SDK rejects as not-base-units.
  const units =
    typeof amount === 'number' && Number.isInteger(amount) && amount >= 0
      ? BigInt(amount)
      : typeof amount === 'string' || typeof amount === 'bigint'
        ? amount
        : null;
  if (units === null || typeof divisibility !== 'number') return name;

  const sym = typeof symbol === 'string' || symbol === null ? symbol : undefined;
  try {
    return `${formatRunePile({ amount: units, divisibility, symbol: sym })} ${name}`;
  } catch {
    return name;
  }
}

/**
 * Rows for a coin the scanner flagged. Any other scan state yields none: a
 * coin that is clean, unscanned, still scanning or failed has nothing to list.
 *
 * @param runeEtchings Rune name to the txid that etched it, for the names
 *   already resolved. A name that is absent renders without a link.
 */
export function fundingAssetRows(
  scan: UtxoScanState | undefined,
  runeEtchings?: ReadonlyMap<string, string>,
): FundingAssetRow[] {
  if (!scan || scan.kind !== 'scanned-with-assets') return [];
  const { inscriptionIds, runes, catIds, cats, catSat, rareSat } = scan.content;
  const rows: FundingAssetRow[] = [];

  for (const id of inscriptionIds) {
    rows.push({ kind: 'inscription', label: id, href: TX_BASE + inscriptionTxid(id) });
  }

  for (const [name, value] of Object.entries(runes ?? {})) {
    const etching = runeEtchings?.get(name);
    rows.push({
      kind: 'rune',
      label: runeLabel(name, value),
      href: etching ? TX_BASE + etching : null,
    });
  }

  rows.push(...catRows(catIds, cats, catSat));

  if (rareSat) {
    // The sat NUMBER is what a holder looks up and trades on; rarity and block
    // together do not identify it, since two sats in one block share them. The
    // sat page resolves it, the same target the notice rows link to.
    rows.push({
      kind: 'rare-sat',
      label: `rare sat: ${rareSat.rarity} · sat ${rareSat.sat} · block ${rareSat.block}`,
      href: SAT_BASE + rareSat.sat,
    });
  }

  return rows;
}

/**
 * Rows for the assets the SDK reports on the coin it RECOMMENDED, as opposed to
 * the scanner state behind a picker row. Same rendering, different source: the
 * recommendation is what the guard actually decided about, so a notice built
 * from it cannot describe a different coin than the one being spent.
 */
export function assetDetailRows(
  assets: {
    inscriptionIds: readonly string[];
    runeNames: readonly string[];
    catIds: readonly string[];
    cats?: readonly CatOnOutpoint[];
    catSat?: number | null;
    rareSat: { sat: string; block: number; rarity: string } | null;
  },
  runeEtchings?: ReadonlyMap<string, string>,
): FundingAssetRow[] {
  const rows: FundingAssetRow[] = [];

  for (const id of assets.inscriptionIds) {
    rows.push({ kind: 'inscription', label: id, href: TX_BASE + inscriptionTxid(id) });
  }

  // The recommendation carries rune NAMES without balances, so the row shows
  // the name alone. A balance would have to come from somewhere else, and that
  // is the second source this function exists to avoid.
  for (const name of assets.runeNames) {
    const etching = runeEtchings?.get(name);
    rows.push({ kind: 'rune', label: name, href: etching ? TX_BASE + etching : null });
  }

  rows.push(...catRows(assets.catIds, assets.cats, assets.catSat));

  if (assets.rareSat) {
    rows.push({
      kind: 'rare-sat',
      label: `${assets.rareSat.rarity} sat ${assets.rareSat.sat} (block ${assets.rareSat.block})`,
      href: SAT_BASE + assets.rareSat.sat,
    });
  }

  return rows;
}
