import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, ReplaySubject, map, share } from 'rxjs';

import { CubeRarity, RarityIndex } from './types';

const RARITY_URL = 'https://ordpool-space.github.io/ordinal-cubes-index/data/rarity.json';

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

  private readonly index$ = this.http.get<RarityIndex>(RARITY_URL).pipe(
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
