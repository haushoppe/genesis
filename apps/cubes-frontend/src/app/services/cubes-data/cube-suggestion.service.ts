import { inject, Injectable } from '@angular/core';
import { Observable, defer, firstValueFrom, from } from 'rxjs';

import { PastMintsService } from '../past-mints.service';
import { CubesDataService } from './cubes-data.service';
import { ArchiveCollection, ArchiveDataService } from './archive-data.service';
import { CubeSuggestion } from './types';

const TOKEN_GOAL = 6;
const TOP_COLLECTION_POOL = 250;

// SVG is excluded — too much trouble, too many black cubes (see the original
// genesis CubeSuggestionService).
const IMAGE_CONTENT_TYPES = new Set([
  'image/apng',
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
]);

const SIDE_TRAIT_TYPES = new Set(['Side 1', 'Side 2', 'Side 3', 'Side 4', 'Side 5', 'Side 6']);

/**
 * Replacement for the backend `/ordinals/getCubeSuggestion/:symbol?` route.
 * Picks six random unclaimed image inscriptions from a random popular
 * collection in the frozen Magic Eden archive.
 */
@Injectable({ providedIn: 'root' })
export class CubeSuggestionService {

  private readonly pastMints = inject(PastMintsService);

  constructor(
    private cubesData: CubesDataService,
    private archive: ArchiveDataService,
  ) {}

  getCubeSuggestion(onlyCollectionSymbol?: string): Observable<CubeSuggestion> {
    return defer(() => from(this.pick(onlyCollectionSymbol)));
  }

  // -------------------------------------------------------------------------

  private async pick(onlyCollectionSymbol?: string): Promise<CubeSuggestion> {
    const cubes = await firstValueFrom(this.cubesData.getAllCubes());

    // Inscription IDs already in use as a cube side — never re-suggest these.
    const claimed = new Set<string>();
    for (const cube of cubes) {
      for (const attr of cube.meta.attributes) {
        if (SIDE_TRAIT_TYPES.has(attr.trait_type)) {
          claimed.add(attr.value);
        }
      }
    }

    // Local mints haven't reached the hourly cubes.json index yet
    // (typical lag: ord ~10 min + hourly cron up to 60 min). Union the
    // user's own recent mints so we never re-suggest their own IDs.
    for (const mint of this.pastMints.pastMints()) {
      for (const id of mint.inscriptionIds) claimed.add(id);
    }

    let candidates: ArchiveCollection[];
    if (onlyCollectionSymbol) {
      const single = await this.archive.getCollection(onlyCollectionSymbol);
      if (!single) throw new Error('Unknown collection!');
      candidates = [single];
    } else {
      candidates = await this.archive.getTopCollections(TOP_COLLECTION_POOL);
    }

    const pool = [...candidates];
    while (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      const current = pool[idx];

      let inscriptions;
      try {
        inscriptions = await this.archive.getInscriptions(current.symbol);
      } catch {
        pool.splice(idx, 1);
        continue;
      }

      const usable = inscriptions
        .filter((i) => IMAGE_CONTENT_TYPES.has(i.contentType))
        .map((i) => i.id)
        .filter((id) => !claimed.has(id));

      if (usable.length >= TOKEN_GOAL) {
        shuffleInPlace(usable);
        const six = usable.slice(0, TOKEN_GOAL);
        return {
          inscriptionId1: six[0],
          inscriptionId2: six[1],
          inscriptionId3: six[2],
          inscriptionId4: six[3],
          inscriptionId5: six[4],
          inscriptionId6: six[5],
          collectionName: current.name,
          collectionSymbol: current.symbol,
        };
      }

      pool.splice(idx, 1);
    }

    throw new Error('Could not find enough unclaimed tokens!');
  }
}

function shuffleInPlace<T>(a: T[]): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
