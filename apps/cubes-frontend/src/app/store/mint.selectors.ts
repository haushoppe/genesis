import { createSelector } from '@ngrx/store';

import { selectOrderResponse } from './mint.reducer';


export const selectFile = createSelector(
  selectOrderResponse,
  orderResponse => {
    if (orderResponse?.files.length) {
      return orderResponse.files[0];
    }
    return undefined;
  }
);


export const selectOrderId = createSelector(
  selectOrderResponse,
  orderResponse => orderResponse?.charge.id
);
