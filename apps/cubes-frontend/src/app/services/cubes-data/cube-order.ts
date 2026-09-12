import { CubeRarity, InscriptionExtended, RarityIndex } from './types';

/** How the minted-cubes list is ordered. `rarity` is the default. */
export type CubeSort = 'newest' | 'rarity';

export const DEFAULT_CUBE_SORT: CubeSort = 'rarity';

/** Turns an outside value into a sort, falling back to the default for anything else. */
export function toCubeSort(value: string | null | undefined): CubeSort {
  return value === 'newest' ? 'newest' : DEFAULT_CUBE_SORT;
}

/** Turns an outside value into a page number: a whole number, never below 1. */
export function toCubePage(value: string | number | null | undefined): number {
  const page = Math.floor(Number(value));
  return Number.isFinite(page) && page > 1 ? page : 1;
}

/**
 * The list's state as query parameters. Defaults are `null`, which removes
 * the parameter, so the plain URL stays plain and a link carries only what
 * differs from the default view.
 */
export function cubeListQueryParams(sort: CubeSort, page: number): { sort: string | null; page: number | null } {
  return {
    sort: sort === DEFAULT_CUBE_SORT ? null : sort,
    page: page > 1 ? page : null,
  };
}

/** The rarity rows keyed by inscription id. */
export function rarityById(index: RarityIndex | null | undefined): Map<string, CubeRarity> {
  const map = new Map<string, CubeRarity>();
  for (const row of index?.cubes ?? []) map.set(row.inscriptionId, row);
  return map;
}

/**
 * Orders the cubes for the list. `all` is the index order (oldest first).
 *
 * - `newest`: latest cube first.
 * - `rarity`: scored cubes by rank (rank 1 first), then every cube without
 *   a rank (cursed, after the close, not in the rarity index yet) newest
 *   first. Without a rarity index the order falls back to `newest`.
 */
export function orderCubes(
  all: readonly InscriptionExtended[],
  sort: CubeSort,
  rarity: Map<string, CubeRarity> | null,
): InscriptionExtended[] {
  const newestFirst = [...all].reverse();
  if (sort !== 'rarity' || !rarity) return newestFirst;
  const rankOf = (cube: InscriptionExtended) => rarity.get(cube.inscriptionId)?.rank ?? null;
  const ranked = newestFirst
    .filter((cube) => rankOf(cube) !== null)
    .sort((a, b) => (rankOf(a) as number) - (rankOf(b) as number));
  const unranked = newestFirst.filter((cube) => rankOf(cube) === null);
  return [...ranked, ...unranked];
}
