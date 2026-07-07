import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { defer, from, of } from 'rxjs';
import {
  catchError,
  concatMap,
  map,
  retry,
  switchMap,
  withLatestFrom,
} from 'rxjs/operators';

import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { CubeSuggestionService } from '../services/cubes-data/cube-suggestion.service';
import { MintActions } from './mint.actions';
import { selectInscriptions, selectKnownInscriptionIds } from './mint.reducer';
import { PageActions } from './page.actions';
import { mapToParam, ofRoute } from './utils-ngrx-router/operators';


/**
 * Look up an inscription's ID from its blessed-number via our
 * ord-proxy (`ord.ordpool.space`). Returns the id string or throws.
 */
async function inscriptionNumberToIdViaOrd(inscriptionNumber: string): Promise<string> {
  const response = await fetch(`https://ord.ordpool.space/inscription/${inscriptionNumber}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`ord returned ${response.status} for inscription ${inscriptionNumber}`);
  }
  const body = await response.json() as { id?: string };
  if (!body?.id) throw new Error(`ord returned no id for inscription ${inscriptionNumber}`);
  return body.id;
}


/**
 * Read-only effects for the cube gallery + single-cube pages. Write-side
 * effects (OrdinalsBot orders, Xverse Sats-Connect flow) were retired
 * when cubes-frontend switched to ordpool-sdk's `InscribeMintOrchestrator`;
 * the orchestrator owns write state via signals directly, so effects
 * here only wrap the two static-JSON reads + the `#N → id` lookup.
 */
@Injectable()
export class MintEffects {

  actions = inject(Actions);
  cubesData = inject(CubesDataService);
  cubeSuggestion = inject(CubeSuggestionService);
  store = inject(Store);

  /**
   * Landing on `/` or `/mint/:collectionSymbol` — load the first page
   * of cubes (if we don't already have them) and refresh the suggested
   * cube for the current collection.
   */
  startPage$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute([
        '',
        'mint/:collectionSymbol'
      ]),
      mapToParam('collectionSymbol'),
      withLatestFrom(this.store.select(selectInscriptions)),
      concatMap(([collectionSymbol, inscriptions]) => [
        ...(inscriptions?.inscriptions.length ? [] : [MintActions.loadInscriptions({
          itemsPerPage: 8,
          currentPage: 1
        })]),
        MintActions.loadCubeSuggestion({ collectionSymbol: collectionSymbol || '' })
      ]),
    );
  });

  loadInscriptions$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.loadInscriptions),
      switchMap(({ itemsPerPage, currentPage }) =>
        this.cubesData.getInscriptions(itemsPerPage, currentPage).pipe(
          retry({ count: 3, delay: 1000 }),
          concatMap(inscriptions => [
            MintActions.loadInscriptionsSuccess({ inscriptions }),
            PageActions.ready()
          ]),
          catchError((error: HttpErrorResponse) => of(MintActions.loadInscriptionsFailure({ error }))))
      )
    );
  });

  loadSingleInscriptionOnRouting$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute(['inscription/:inscriptionId']),
      mapToParam('inscriptionId'),
      map(inscriptionId => MintActions.loadSingleInscription({ inscriptionId }))
    );
  });

  loadSingleInscription$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.loadSingleInscription),
      switchMap(({ inscriptionId }) =>
        this.cubesData.getSingleInscription(inscriptionId).pipe(
          retry({ count: 3, delay: 1000 }),
          concatMap(singleInscription => [
            MintActions.loadSingleInscriptionSuccess({ singleInscription }),
            PageActions.ready()
          ]),
          catchError((error: HttpErrorResponse) => of(MintActions.loadSingleInscriptionFailure({ error }))))
      )
    );
  });

  /**
   * Number-to-id lookup for `#12345`-typed inputs. Cache in-memory
   * per session (via the reducer); ord-proxy is fast enough that a
   * cold miss over the wire is fine.
   */
  lookupInscriptionId$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.lookupInscriptionId),
      withLatestFrom(this.store.select(selectKnownInscriptionIds)),
      switchMap(([{ inscriptionNumber }, knownInscriptionIds]) => {
        const cached = knownInscriptionIds[inscriptionNumber];
        if (cached) {
          return of(MintActions.lookupInscriptionIdSuccess({ inscriptionNumber, inscriptionId: cached }));
        }
        return defer(() => from(inscriptionNumberToIdViaOrd(inscriptionNumber))).pipe(
          retry({ count: 3, delay: 1000 }),
          map(inscriptionId => MintActions.lookupInscriptionIdSuccess({ inscriptionNumber, inscriptionId })),
          catchError((error: HttpErrorResponse) => of(MintActions.lookupInscriptionIdFailure({ error })))
        );
      })
    );
  });

  loadCubeSuggestion$ = createEffect(() =>
    this.actions.pipe(
      ofType(MintActions.loadCubeSuggestion),
      switchMap(({ collectionSymbol }) =>
        this.cubeSuggestion.getCubeSuggestion(collectionSymbol).pipe(
          retry({ count: 5, delay: 1000 }),
          map(cubeSuggestion => MintActions.loadCubeSuggestionSuccess({ cubeSuggestion })),
          catchError((error: HttpErrorResponse) => of(MintActions.loadCubeSuggestionFailure({ error })))
        )
      )
    )
  );
}
