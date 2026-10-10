import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, ReplaySubject, map, of, share } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CubeRarity, RarityIndex } from './types';

/** `rarity.json` sits beside `cubes.json` in the cubes index. Empty when the chain has no index. */
const RARITY_URL = environment.cubesIndexBase ? `${environment.cubesIndexBase}/rarity.json` : '';

/** The answer for a chain without a cubes index: nothing is scored, nothing is fetched. */
const NO_RARITY_INDEX: RarityIndex = {
  totalCubes: 0,
  scoredCubes: 0,
  cursedCubes: 0,
  afterCloseCubes: 0,
  collections: [],
  cubes: [],
};

/** A cube's rarity row plus the totals it is ranked against. */
export interface CubeRarityView {
  cube: CubeRarity;
  scoredCubes: number;
}

/**
 * The rarity score computed by the cubes index after every grind
 * (`ordinal-cubes-index/scripts/score.mjs`; rules in that repo's README
 * under "Rarity"). One fetch, shared and replayed; a cube's row is looked
 * up by inscription id.
 */
@Injectable({ providedIn: 'root' })
export class RarityService {

  private readonly http = inject(HttpClient);

  private readonly index$ = (RARITY_URL ? this.http.get<RarityIndex>(RARITY_URL) : of(NO_RARITY_INDEX)).pipe(
    share({
      connector: () => new ReplaySubject<RarityIndex>(1),
      resetOnError: true,
      resetOnComplete: false,
      resetOnRefCountZero: false,
    }),
  );

  getIndex(): Observable<RarityIndex> {
    return this.index$;
  }

  /** The row for one cube, or null when the index does not know it yet. */
  getRarity(inscriptionId: string): Observable<CubeRarityView | null> {
    return this.index$.pipe(
      map((index) => {
        const cube = index.cubes.find((c) => c.inscriptionId === inscriptionId);
        return cube ? { cube, scoredCubes: index.scoredCubes } : null;
      }),
    );
  }
}
