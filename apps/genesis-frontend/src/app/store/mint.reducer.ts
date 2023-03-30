import { createFeature, createReducer, on } from '@ngrx/store';

import { Metadata, MintTicket } from '../openapi-client';
import { MintActions } from './mint.actions';
import {
  getFailureState,
  getInitialState,
  getSubmittingState,
  getSuccessfulState,
  SubmittableState,
} from './submittable/submittable-state';

export interface State {
  allMints: Metadata[];
  allMintsStatus: SubmittableState;

  tokenInfo: Metadata | undefined;
  tokenInfoStatus: SubmittableState;

  totalSupply: number | undefined;
  totalSupplyStatus: SubmittableState;

  mintTicket: MintTicket | undefined;
  mintTicketStatus: SubmittableState;
}

export const initialState: State = {
  allMints: [],
  allMintsStatus: getInitialState(),

  tokenInfo: undefined,
  tokenInfoStatus: getInitialState(),

  totalSupply: undefined,
  totalSupplyStatus: getInitialState(),

  mintTicket: undefined,
  mintTicketStatus: getInitialState()
};


export const mintFeature = createFeature({
  name: 'mint',
  reducer: createReducer(
    initialState,

    // Load All Mints

    on(MintActions.loadAllMints, state => ({
      ...state,
      // no reset
      allMintsStatus: getSubmittingState()
    })),

    on(MintActions.loadAllMintsSuccess, (state, { allMints }) => ({
      ...state,
      allMints,
      allMintsStatus: getSuccessfulState()
    })),

    on(MintActions.loadAllMintsFailure, (state, { error }) => ({
      ...state,
      allMintsStatus: getFailureState(error.message)
    })),

    // Load Token Info

    on(MintActions.loadTokenInfo, state => ({
      ...state,
       // reset previous tokenInfo to not show outdated data while loading!
      tokenInfo: undefined,
      tokenInfoStatus: getSubmittingState()
    })),

    on(MintActions.loadTokenInfoSuccess, (state, { tokenInfo }) => ({
      ...state,
      tokenInfo,
      tokenInfoStatus: getSuccessfulState()
    })),

    on(MintActions.loadTokenInfoFailure, (state, { error }) => ({
      ...state,
      tokenInfoStatus: getFailureState(error.message)
    })),

    // Load Total Supply

    on(MintActions.loadTotalSupply, state => ({
      ...state,
      // no reset
      totalSupplyStatus: getSubmittingState()
    })),

    on(MintActions.loadTotalSupplySuccess, (state, { totalSupply }) => ({
      ...state,
      totalSupply,
      totalSupplyStatus: getSuccessfulState()
    })),

    on(MintActions.loadTotalSupplyFailure, (state, { error }) => ({
      ...state,
      totalSupplyStatus: getFailureState(error.message)
    })),

    // MintTicket

    on(MintActions.loadMintTicket, state => ({
      ...state,
      // no reset
      mintTicketStatus: getSubmittingState()
    })),

    on(MintActions.loadMintTicketSuccess, (state, { mintTicket }) => ({
      ...state,
      mintTicket,
      mintTicketStatus: getSuccessfulState()
    })),

    on(MintActions.loadMintTicketFailure, (state, { error }) => ({
      ...state,
      mintTicketStatus: getFailureState(error.message)
    })),

    on(MintActions.clearMintTicket, state => ({
      ...state,
      mintTicket: undefined,
      mintTicketStatus: getInitialState()
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
  selectTokenInfoStatus,
  selectTotalSupply,
  selectTotalSupplyStatus,
  selectMintTicket,
  selectMintTicketStatus
} = mintFeature;
