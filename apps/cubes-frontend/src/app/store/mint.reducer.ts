import { createFeature, createReducer, on } from '@ngrx/store';

import {
  CubeSuggestion,
  InscriptionExtendedPaginatedResult,
  InscriptionExtendedSingleResult,
} from '../services/cubes-data/types';
import { MintActions } from './mint.actions';
import {
  getFailureState,
  getInitialState,
  getSubmittingState,
  getSuccessfulState,
  SubmittableState,
} from './submittable/submittable-state';


export interface State {
  inscriptions: InscriptionExtendedPaginatedResult;
  inscriptionsStatus: SubmittableState;

  singleInscription: InscriptionExtendedSingleResult | undefined;
  singleInscriptionStatus: SubmittableState;

  knownInscriptionIds: { [inscriptionNumber: string]: string };
  knownInscriptionIdStatus: SubmittableState;

  cubeSuggestion: CubeSuggestion | undefined;
  cubeSuggestionStatus: SubmittableState;
}

export const initialState: State = {
  inscriptions: {
    inscriptions: [],
    currentPage: 0,
    itemsPerPage: 0,
    totalInscriptions: 0
  },
  inscriptionsStatus: getInitialState(),

  singleInscription: undefined,
  singleInscriptionStatus: getInitialState(),

  knownInscriptionIds: {},
  knownInscriptionIdStatus: getInitialState(),

  cubeSuggestion: undefined,
  cubeSuggestionStatus: getInitialState()
};


export const mintFeature = createFeature({
  name: 'mint',
  reducer: createReducer(
    initialState,

    // Load Paged Inscriptions

    on(MintActions.loadInscriptions, state => ({
      ...state,
      inscriptionsStatus: getSubmittingState()
    })),

    on(MintActions.loadInscriptionsSuccess, (state, { inscriptions }) => ({
      ...state,
      inscriptions,
      inscriptionsStatus: getSuccessfulState()
    })),

    on(MintActions.loadInscriptionsFailure, (state, { error }) => ({
      ...state,
      inscriptionsStatus: getFailureState(error)
    })),

    // Load Single Inscription

    on(MintActions.loadSingleInscription, state => ({
      ...state,
      singleInscription: undefined,
      singleInscriptionStatus: getSubmittingState()
    })),

    on(MintActions.loadSingleInscriptionSuccess, (state, { singleInscription }) => ({
      ...state,
      singleInscription,
      singleInscriptionStatus: getSuccessfulState()
    })),

    on(MintActions.loadSingleInscriptionFailure, (state, { error }) => ({
      ...state,
      singleInscriptionStatus: getFailureState(error)
    })),

    // Lookup Inscription Id

    on(MintActions.lookupInscriptionId, state => ({
      ...state,
      knownInscriptionIdStatus: getSubmittingState()
    })),

    on(MintActions.lookupInscriptionIdSuccess, (state, { inscriptionNumber, inscriptionId }) => ({
      ...state,
      knownInscriptionIds: {
        ...state.knownInscriptionIds,
        [inscriptionNumber]: inscriptionId
      },
      knownInscriptionIdStatus: getSuccessfulState()
    })),

    on(MintActions.lookupInscriptionIdFailure, (state, { error }) => ({
      ...state,
      knownInscriptionIdStatus: getFailureState(error)
    })),

    // Load Cube Suggestion

    on(MintActions.loadCubeSuggestion, state => ({
      ...state,
      cubeSuggestionStatus: getSubmittingState()
    })),

    on(MintActions.loadCubeSuggestionSuccess, (state, { cubeSuggestion }) => ({
      ...state,
      cubeSuggestion,
      // Always reset to initial state so the "Suggest another cube" button
      // stays clickable — the loading-indicator-button treats
      // getSuccessfulState() as "done, stop letting the user click me".
      cubeSuggestionStatus: getInitialState()
    })),

    on(MintActions.loadCubeSuggestionFailure, (state, { error }) => ({
      ...state,
      cubeSuggestionStatus: getFailureState(error)
    }))
  )
});

export const {
  name,
  reducer,
  selectMintState,

  selectInscriptions,
  selectInscriptionsStatus,
  selectSingleInscription,
  selectSingleInscriptionStatus,

  selectKnownInscriptionIds,
  selectKnownInscriptionIdStatus,

  selectCubeSuggestion,
  selectCubeSuggestionStatus

} = mintFeature;
