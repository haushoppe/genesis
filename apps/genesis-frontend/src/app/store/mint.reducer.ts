import { createFeature, createReducer, on } from '@ngrx/store';
import { Metadata } from '../openapi-client';
import { MintActions } from './mint.actions';
import { SubmitStatus } from './submit-status';
import { initialSubmittableState, SubmittableState } from './submittable-state';

export interface State {
  mints: Metadata[],
  mintsStatus: SubmittableState
}

export const initialState: State = {
  mints: [],
  mintsStatus: { ...initialSubmittableState }
};


export const mintFeature = createFeature({
  name: 'mint',
  reducer: createReducer(
    initialState,

    on(MintActions.loadMints, state => ({
      ...state,
      mintsStatus: {
        submitStatus: SubmitStatus.Submitting,
        submitErrorText: ''
      }
    })),

    on(MintActions.loadMintsSuccess, (state, { mints }) => ({
      ...state,
      mintsStatus: {
        submitStatus: SubmitStatus.Successful,
        submitErrorText: ''
      },
      mints
    })),

    on(MintActions.loadMintsFailure, (state, { error }) => ({
      ...state,
      mintsStatus: {
        submitStatus: SubmitStatus.Failure,
        submitErrorText: error.message
      },
    }))
  )
});

export const {
  name, // feature name
  reducer, // feature reducer
  selectMintState, // feature selector
  selectMints, // selector for `mints` property
  selectMintsStatus, // selector for `mintsStatus` property
} = mintFeature;
