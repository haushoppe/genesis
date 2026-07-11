import { RouterReducerState } from '@ngrx/router-store';
import { createFeatureSelector, createSelector } from '@ngrx/store';

import { selectKnownInscriptionIds } from './mint.reducer';

export const selectRouter = createFeatureSelector<RouterReducerState<any>>('router');


export function selectInscriptionId(inscriptionNumber: string) {
  return createSelector(
    selectKnownInscriptionIds,
    knownInscriptionIds => knownInscriptionIds[inscriptionNumber],
  );
}


/** True when the mint route hardcodes a collectionSymbol
 *  (`/mint/:collectionSymbol`) — the mint form then shows the fixed
 *  suggestion instead of the "get another" button. */
export const selectCubeSuggestionFixed = createSelector(
  selectRouter,
  ({ state: { params } }: {
    state: {
      params: { [parm: string]: string | undefined }
    }
  }) => !!params['collectionSymbol'],
);
