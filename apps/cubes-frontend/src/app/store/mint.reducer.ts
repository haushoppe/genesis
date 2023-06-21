import { createFeature, createReducer, on } from '@ngrx/store';

import { MintActions } from './mint.actions';
import {
  getFailureState,
  getInitialState,
  getSubmittingState,
  getSuccessfulState,
  SubmittableState,
} from './submittable/submittable-state';
import { exampleUnpaidResponse, OrderResponse } from '../ordinalsbot';

export interface SixInscriptionIds {
  inscriptionId1?: string;
  inscriptionId2?: string;
  inscriptionId3?: string;
  inscriptionId4?: string;
  inscriptionId5?: string;
  inscriptionId6?: string;
}

export interface State {
  allTokenMetadata: any;
  allTokenMetadataStatus: SubmittableState;

  // info about one single token, used for the details page
  // tokenMetadataAndOwner: any | undefined;
  // tokenMetadataAndOwnerStatus: SubmittableState;

  mintOrderResponse: OrderResponse | undefined;
  mintStatus: SubmittableState;
}

export const initialState: State = {
  allTokenMetadata: [],
  allTokenMetadataStatus: getInitialState(),

  // tokenMetadataAndOwner: undefined,
  // tokenMetadataAndOwnerStatus: getInitialState(),

  // mintOrderResponse: undefined,
  mintOrderResponse: exampleUnpaidResponse as OrderResponse,
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

    on(MintActions.loadAllTokenMetadataSuccess, (state) => ({
      ...state,
      // allTokenMetadata,
      allTokenMetadataStatus: getSuccessfulState()
    })),

    on(MintActions.loadAllTokenMetadataFailure, (state, { error }) => ({
      ...state,
      allTokenMetadataStatus: getFailureState(error)
    })),

    // Load Token Info

    // on(MintActions.loadTokenMetadata, state => ({
    //   ...state,
    //    // reset previous tokenMetadataAndOwner to not show outdated data while loading!
    //   tokenMetadataAndOwner: undefined,
    //   tokenMetadataAndOwnerStatus: getSubmittingState()
    // })),

    // on(MintActions.loadTokenMetadataSuccess, (state) => ({
    //   ...state,
    //   // tokenMetadataAndOwner,
    //   tokenMetadataAndOwnerStatus: getSuccessfulState()
    // })),

    // on(MintActions.loadTokenMetadataFailure, (state, { error }) => ({
    //   ...state,
    //   tokenMetadataAndOwnerStatus: getFailureState(error)
    // })),

    // Mint!

    on(MintActions.mint, state => ({
      ...state,
      mintOrderResponse: undefined,
      mintStatus: getSubmittingState()
    })),

    on(MintActions.mintSuccess, (state, { mintOrderResponse }) => ({
      ...state,
      mintOrderResponse,
      mintStatus: getSuccessfulState()
    })),

    on(MintActions.mintFailure, (state, { error }) => ({
      ...state,
      mintOrderResponse: undefined,
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
  selectMintOrderResponse,
  selectMintStatus
} = mintFeature;
