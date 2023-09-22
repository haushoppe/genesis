import { RouterReducerState } from '@ngrx/router-store';
import { createFeatureSelector, createSelector } from '@ngrx/store';

import { selectInscription, selectKnownInscriptionIds, selectOrderResponse } from './mint.reducer';

export const selectRouter = createFeatureSelector<RouterReducerState<any>>('router');


export const selectFile = createSelector(
  selectOrderResponse,
  orderResponse => {
    if (orderResponse?.files.length) {
      return orderResponse.files[0];
    }
    return undefined;
  }
);

export const selectIsOrderPending = createSelector(
  selectFile,
  file => {
    if (file?.sent) {
      return false;
    }
    return true;
  }
);

export const selectBestOrderId = createSelector(
  selectOrderResponse,
  selectRouter,
  (orderResponse, { state: { params }}: {
    state: {
      params: { [parm: string]: string | undefined }
    }
  }) => orderResponse?.id || params.orderId
);

export const selectBestInscriptionId = createSelector(
  selectInscription,
  selectRouter,
  (inscriptionResponse, { state: { params }}: {
    state: {
      params: { [parm: string]: string | undefined }
    }
  }) => inscriptionResponse?.txid || params.txId
);

export function selectInscriptionId(inscriptionNumber: string) {
  return createSelector(
    selectKnownInscriptionIds,
    knownInscriptionIds  => knownInscriptionIds[inscriptionNumber]
  );
}


// NOT WORKING?!?!
// export const selectCollectionSymbol = selectRouteParam('collectionSymbol');

// the suggestion is fixed, if the collectionSymbol is in the route
export const selectCubeSuggestionFixed = createSelector(
  selectRouter,
  ({ state: { params }}: {
    state: {
      params: { [parm: string]: string | undefined }
    }
  }) => !!params.collectionSymbol
)


