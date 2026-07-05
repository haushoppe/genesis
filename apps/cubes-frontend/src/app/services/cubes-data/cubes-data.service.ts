import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject, defer, map, of, shareReplay, switchMap, throwError } from 'rxjs';

import {
  CubeSuggestion,
  InscriptionExtended,
  InscriptionExtendedPaginatedResult,
  InscriptionExtendedSingleResult,
} from './types';

const CUBES_URL = 'https://ordpool-space.github.io/ordinal-cubes-index/data/cubes.json';
const CURSOR_URL = 'https://ordpool-space.github.io/ordinal-cubes-index/data/cursor.json';

/** Shape of records in cubes.json — flat fields, becomes `meta`-nested for the frontend. */
interface ExternalCube {
  inscriptionId: string;
  inscriptionNumber: number;
  blockHeight: number;
  timestamp?: number;
  contentLength?: number;
  attributes: { trait_type: string; value: string }[];
  name: string;
}

/** Shape of cursor.json — how far the indexer has walked. */
export interface IndexCursor {
  lastScannedId: string;
  lastScannedNumber: number;
  lastScannedBlockHeight?: number;
  blessedTipAtLastRun: number;
  lastScanAt: string;
  source: string;
}

/**
 * Direct, frontend-side fetch of the cube index. Replaces the backend
 * `/ordinals/getInscriptions/...` round-trip — same shape out, no server hop.
 */
@Injectable({ providedIn: 'root' })
export class CubesDataService {

  /**
   * One in-flight HTTP request, replayed to every concurrent caller.
   * Reuses the result for the rest of the session.
   */
  private readonly all$ = this.http.get<ExternalCube[]>(CUBES_URL).pipe(
    map((raw) => raw.map(toInscriptionExtended)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  private readonly cursor$ = this.http.get<IndexCursor>(CURSOR_URL).pipe(
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  constructor(private http: HttpClient) {}

  /** Every known cube, sorted by (blockHeight, inscriptionNumber). */
  getAllCubes(): Observable<InscriptionExtended[]> {
    return this.all$;
  }

  /** Where the indexer has walked to. Lets the UI show "indexed up to block N". */
  getCursor(): Observable<IndexCursor> {
    return this.cursor$;
  }

  /**
   * Paginated, latest-first. Matches the old `getInscriptions` response shape.
   */
  getInscriptions(
    itemsPerPage: number,
    currentPage: number,
  ): Observable<InscriptionExtendedPaginatedResult> {
    return this.all$.pipe(
      map((all) => {
        const reversed = [...all].reverse();
        const start = (currentPage - 1) * itemsPerPage;
        return {
          inscriptions: reversed.slice(start, start + itemsPerPage),
          totalInscriptions: reversed.length,
          itemsPerPage,
          currentPage,
        };
      }),
    );
  }

  /**
   * Look up a single cube with its previous/next neighbours in the
   * latest-first listing. Matches the old `getSingleInscription` shape.
   */
  getSingleInscription(inscriptionId: string): Observable<InscriptionExtendedSingleResult> {
    return this.all$.pipe(
      switchMap((all) => {
        const reversed = [...all].reverse();
        const idx = reversed.findIndex((c) => c.inscriptionId === inscriptionId);
        if (idx < 0) {
          return throwError(() => new Error(`Cube not found: ${inscriptionId}`));
        }
        return of({
          inscription: reversed[idx],
          previousInscriptionId: idx > 0 ? reversed[idx - 1].inscriptionId : null,
          nextInscriptionId: idx < reversed.length - 1 ? reversed[idx + 1].inscriptionId : null,
        });
      }),
    );
  }
}

// ---------------------------------------------------------------------------

function toInscriptionExtended(c: ExternalCube): InscriptionExtended {
  return {
    inscriptionId: c.inscriptionId,
    inscriptionNumber: c.inscriptionNumber,
    blockHeight: c.blockHeight,
    meta: { name: c.name, attributes: c.attributes },
  };
}
