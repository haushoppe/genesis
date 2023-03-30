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

  mintAllowlistStatus: SubmittableState
}

export const initialState: State = {
  allMints: [],
  allMintsStatus: getInitialState(),

  tokenInfo: undefined,
  tokenInfoStatus: getInitialState(),

  totalSupply: undefined,
  totalSupplyStatus: getInitialState(),

  mintTicket: undefined,
  mintTicketStatus: getInitialState(),

  mintAllowlistStatus: getInitialState()
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
      allMintsStatus: getFailureState(error)
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
      tokenInfoStatus: getFailureState(error)
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
      totalSupplyStatus: getFailureState(error)
    })),

    // MintTicket

    on(MintActions.loadMintTicket, state => ({
      ...state,
      // no reset
      mintTicketStatus: getSubmittingState(),

      // but reset last allowlist status because a new ticket means a new chance
      mintAllowlistStatus: getInitialState()
    })),

    on(MintActions.loadMintTicketSuccess, (state, { mintTicket }) => ({
      ...state,
      mintTicket,
      mintTicketStatus: getSuccessfulState()
    })),

    on(MintActions.loadMintTicketFailure, (state, { error }) => ({
      ...state,
      mintTicketStatus: getFailureState(error)
    })),

    on(MintActions.clearMintTicket, state => ({
      ...state,
      mintTicket: undefined,
      mintTicketStatus: getInitialState()
    })),

    // Mints via Allowlist method (with a MintTicket)

    on(MintActions.mintAllowlist, state => ({
      ...state,
      mintAllowlistStatus: getSubmittingState()
    })),

    on(MintActions.mintAllowlistSuccess, state => ({
      ...state,
      mintAllowlistStatus: getSuccessfulState()
    })),

    on(MintActions.mintAllowlistFailure, (state, { error }) => ({
      ...state,
      mintAllowlistStatus: getFailureState(error)
    })),
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
  selectMintTicketStatus,
  selectMintAllowlistStatus
} = mintFeature;
