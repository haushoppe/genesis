import { createFeature, createReducer, on } from '@ngrx/store';

import { Metadata, MintTicket, TokenOwner } from '../openapi-client';
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

  tokenMetadataAndOwner: { metadata: Metadata, owner: TokenOwner } | undefined;
  tokenMetadataAndOwnerStatus: SubmittableState;

  totalSupply: number | undefined;
  totalSupplyStatus: SubmittableState;

  mintTicket: MintTicket | undefined;
  mintTicketStatus: SubmittableState;

  mintAllowlistStatus: SubmittableState
}

export const initialState: State = {
  allTokenMetadata: [],
  allTokenMetadataStatus: getInitialState(),

  tokenMetadataAndOwner: undefined,
  tokenMetadataAndOwnerStatus: getInitialState(),

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
  selectAllTokenMetadata,
  selectAllTokenMetadataStatus,
  selectTokenMetadataAndOwner,
  selectTokenMetadataAndOwnerStatus,
  selectTotalSupply,
  selectTotalSupplyStatus,
  selectMintTicket,
  selectMintTicketStatus,
  selectMintAllowlistStatus
} = mintFeature;
