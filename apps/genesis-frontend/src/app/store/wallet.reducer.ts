import { createFeature, createReducer } from '@ngrx/store';

import { Metadata } from '../openapi-client';
import { initialSubmittableState, SubmittableState } from './submittable/submittable-state';

export interface State {
  allMints: Metadata[];
  allMintsStatus: SubmittableState;
}

export const initialState: State = {
  allMints: [],
  allMintsStatus: { ...initialSubmittableState },
};


export const walletFeature = createFeature({
  name: 'wallet',
  reducer: createReducer(
    initialState,


  )
});

export const {
  name, // feature name
  reducer, // feature reducer
  selectWalletState, // feature selector
  selectAllMints, // selector for `allMints` property
  selectAllMintsStatus, // selector for `allMintsStatus` property
} = walletFeature;
