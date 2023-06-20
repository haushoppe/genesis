import { createFeature, createReducer, on } from '@ngrx/store';

import { ListOfOwnedTokens, Metadata, MintTicket, TokenOwner } from '../openapi-client';
import { MintActions } from './mint.actions';
import {
  getFailureState,
  getInitialState,
  getSubmittingState,
  getSuccessfulState,
  SubmittableState,
} from './submittable/submittable-state';

export interface State {
  allTokenMetadata: Metadata[];
  allTokenMetadataStatus: SubmittableState;

  // info about one single token, used for the details page
  tokenMetadataAndOwner: { metadata: Metadata, owner: TokenOwner } | undefined;
  tokenMetadataAndOwnerStatus: SubmittableState;

  mintStatus: SubmittableState;
}

export const initialState: State = {
  allTokenMetadata: [],
  allTokenMetadataStatus: getInitialState(),

  tokenMetadataAndOwner: undefined,
  tokenMetadataAndOwnerStatus: getInitialState(),

  mintStatus: getInitialState(),
};


export const mintFeature = createFeature({
  name: 'mint',
  reducer: createReducer(
    initialState,

    // Load All Mints

    on(MintActions.loadAllTokenMetadata, state => ({
      ...state,
      // no reset
      allTokenMetadataStatus: getSubmittingState()
    })),

    on(MintActions.loadAllTokenMetadataSuccess, (state, { allTokenMetadata }) => ({
      ...state,
      allTokenMetadata,
      allTokenMetadataStatus: getSuccessfulState()
    })),

    on(MintActions.loadAllTokenMetadataFailure, (state, { error }) => ({
      ...state,
      allTokenMetadataStatus: getFailureState(error)
    })),

    // Load Token Info

    on(MintActions.loadTokenMetadata, state => ({
      ...state,
       // reset previous tokenMetadataAndOwner to not show outdated data while loading!
      tokenMetadataAndOwner: undefined,
      tokenMetadataAndOwnerStatus: getSubmittingState()
    })),

    on(MintActions.loadTokenMetadataSuccess, (state, { tokenMetadataAndOwner }) => ({
      ...state,
      tokenMetadataAndOwner,
      tokenMetadataAndOwnerStatus: getSuccessfulState()
    })),

    on(MintActions.loadTokenMetadataFailure, (state, { error }) => ({
      ...state,
      tokenMetadataAndOwnerStatus: getFailureState(error)
    })),

    // Mint!

    on(MintActions.mint, state => ({
      ...state,
      mintStatus: getSubmittingState()
    })),

    on(MintActions.mintSuccess, (state) => ({
      ...state,
      mintStatus: getSuccessfulState()
    })),

    on(MintActions.mintFailure, (state, { error }) => ({
      ...state,
      mintStatus: getFailureState(error)
    }))
  )
});

export const {
  name,
  reducer,
  selectMintState,
  selectAllTokenMetadata,
  selectAllTokenMetadataStatus,
  selectTokenMetadataAndOwner,
  selectTokenMetadataAndOwnerStatus,
  selectMintStatus
} = mintFeature;
