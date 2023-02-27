import { createFeature, createReducer, on } from '@ngrx/store';
import { Metadata } from '../openapi-client';
import { MintActions } from './mint.actions';
import { SubmitStatus } from './submit-status';
import { initialSubmittableState, SubmittableState } from './submittable-state';

export interface State {
  allMints: Metadata[];
  allMintsStatus: SubmittableState;

  tokenInfo: Metadata | undefined;
  tokenInfoStatus: SubmittableState;
}

export const initialState: State = {
  allMints: [],
  allMintsStatus: { ...initialSubmittableState },

  tokenInfo: undefined,
  tokenInfoStatus: { ...initialSubmittableState }
};


export const mintFeature = createFeature({
  name: 'mint',
  reducer: createReducer(
    initialState,

    // Load All Mints

    on(MintActions.loadAllMints, state => ({
      ...state,
      allMintsStatus: {
        ...initialSubmittableState,
        submitStatus: SubmitStatus.Submitting
      }
    })),

    on(MintActions.loadAllMintsSuccess, (state, { allMints }) => ({
      ...state,
      allMints,
      allMintsStatus: {
        ...initialSubmittableState,
        submitStatus: SubmitStatus.Successful,
      }
    })),

    on(MintActions.loadAllMintsFailure, (state, { error }) => ({
      ...state,
      allMintsStatus: {
        ...initialSubmittableState,
        submitStatus: SubmitStatus.Failure,
        submitErrorText: error.message
      }
    })),

    // Load Token Info

    on(MintActions.loadTokenInfo, state => ({
      ...state,
       // reset previous tokenInfo to not show outdated data while loading!
      tokenInfo: undefined,
      tokenInfoStatus: {
        ...initialSubmittableState,
        submitStatus: SubmitStatus.Submitting
      }
    })),

    on(MintActions.loadTokenInfoSuccess, (state, { tokenInfo }) => ({
      ...state,
      tokenInfo,
      tokenInfoStatus: {
        ...initialSubmittableState,
        submitStatus: SubmitStatus.Successful,
      }
    })),

    on(MintActions.loadTokenInfoFailure, (state, { error }) => ({
      ...state,
      tokenInfoStatus: {
        ...initialSubmittableState,
        submitStatus: SubmitStatus.Failure,
        submitErrorText: error.message
      }
    }))
  )
});

export const {
  name, // feature name
  reducer, // feature reducer
  selectMintState, // feature selector
  selectAllMints, // selector for `allMints` property
  selectAllMintsStatus, // selector for `allMintsStatus` property
  selectTokenInfo,
  selectTokenInfoStatus
} = mintFeature;
