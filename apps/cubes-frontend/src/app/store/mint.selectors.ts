import { createFeatureSelector, createSelector } from '@ngrx/store';

import { selectKnownInscriptionIds, selectOrderResponse } from './mint.reducer';
import { RouterReducerState } from '@ngrx/router-store';
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

export const selectIsPaymentPending = createSelector(
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
      params: { [parm: string]: string }
    }
  }) => orderResponse?.id || params.orderId
);

export function selectInscriptionId(inscriptionNumber: string) {
  return createSelector(
    selectKnownInscriptionIds,
    knownInscriptionIds  => knownInscriptionIds[inscriptionNumber]
  );
}
