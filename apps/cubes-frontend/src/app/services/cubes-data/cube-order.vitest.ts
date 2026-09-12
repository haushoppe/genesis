import { describe, expect, it } from 'vitest';

import { DEFAULT_CUBE_SORT, orderCubes, rarityById, toCubeSort } from './cube-order';
import { CubeRarity, InscriptionExtended, RarityIndex } from './types';

function cube(n: number): InscriptionExtended {
  return { inscriptionId: `cube-${n}`, inscriptionNumber: n, blockHeight: 800000 + n, meta: { name: `Ordinal Cube #${n}`, attributes: [] } };
}

function row(n: number, rank: number | null, status: CubeRarity['status'] = rank === null ? 'cursed' : 'scored'): CubeRarity {
  return {
    inscriptionId: `cube-${n}`, position: n, status, cursed: [], blackSides: [], reusedSides: [], collection: null, collections: [],
    validOrdinal: null, tier: null, tierBonus: null, popularity: null, popularityPoints: null, score: rank === null ? null : 300 - rank, rank,
  };
}

function index(rows: CubeRarity[]): RarityIndex {
  return { totalCubes: rows.length, scoredCubes: rows.filter((r) => r.rank !== null).length, cursedCubes: 0, afterCloseCubes: 0, collections: [], cubes: rows };
}

// Index order is oldest first: cube 0 .. cube 5.
const all = [0, 1, 2, 3, 4, 5].map(cube);
const ids = (list: InscriptionExtended[]) => list.map((c) => c.inscriptionNumber);

describe('toCubeSort', () => {
  it('accepts newest and falls back to the rarity default for anything else', () => {
    expect(toCubeSort('newest')).toBe('newest');
    expect(toCubeSort('rarity')).toBe('rarity');
    expect(toCubeSort('score')).toBe('rarity');
    expect(toCubeSort(null)).toBe('rarity');
    expect(toCubeSort(undefined)).toBe('rarity');
  });

  it('the list defaults to rarity', () => {
    expect(DEFAULT_CUBE_SORT).toBe('rarity');
  });
});

describe('orderCubes', () => {
  it('newest: the latest cube first', () => {
    expect(ids(orderCubes(all, 'newest', null))).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it('rarity: rank 1 first, then the unranked cubes newest first', () => {
    // ranks: cube 3 -> 1, cube 0 -> 2, cube 5 -> 3; cubes 1, 2, 4 cursed (no rank)
    const rarity = rarityById(index([row(0, 2), row(1, null), row(2, null), row(3, 1), row(4, null), row(5, 3)]));
    expect(ids(orderCubes(all, 'rarity', rarity))).toEqual([3, 0, 5, 4, 2, 1]);
  });

  it('rarity: a cube missing from the index counts as unranked', () => {
    const rarity = rarityById(index([row(4, 1), row(2, 2)]));
    expect(ids(orderCubes(all, 'rarity', rarity))).toEqual([4, 2, 5, 3, 1, 0]);
  });

  it('rarity without an index falls back to newest', () => {
    expect(ids(orderCubes(all, 'rarity', null))).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it('does not mutate the input', () => {
    const copy = [...all];
    orderCubes(all, 'rarity', rarityById(index([row(1, 1)])));
    expect(all).toEqual(copy);
  });
});

describe('rarityById', () => {
  it('keys the rows by inscription id and tolerates a missing index', () => {
    const map = rarityById(index([row(7, 1)]));
    expect(map.get('cube-7')?.rank).toBe(1);
    expect(rarityById(null).size).toBe(0);
  });
});
