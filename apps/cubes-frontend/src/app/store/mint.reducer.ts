import { routerNavigatedAction } from '@ngrx/router-store';
import { createFeature, createReducer, on } from '@ngrx/store';

import { InscriptionSimple } from '../openapi-client';
import { Inscription, InscriptionOrder } from '../ordinalsbot';
import { MintActions } from './mint.actions';
import {
  getFailureState,
  getInitialState,
  getSubmittingState,
  getSuccessfulState,
  SubmittableState,
} from './submittable/submittable-state';

export interface SixInscriptionIds {
  inscriptionId1?: string;
  inscriptionId2?: string;
  inscriptionId3?: string;
  inscriptionId4?: string;
  inscriptionId5?: string;
  inscriptionId6?: string;
}

export interface State {
  allInscriptions: InscriptionSimple[];
  allInscriptionsStatus: SubmittableState;

  // info about one single inscription, used for the details page
  inscription: Inscription | undefined;
  inscriptionStatus: SubmittableState;

  orderResponse: InscriptionOrder | undefined;
  orderStatus: SubmittableState;
}

export const initialState: State = {
  allInscriptions: [],
  allInscriptionsStatus: getInitialState(),

  inscription: undefined,
  inscriptionStatus: getInitialState(),

  orderResponse: undefined,
  //orderResponse: examplePaidResponse as OrderResponse,
  // orderResponse: exampleUnpaidResponse as OrderResponse,
  orderStatus: getInitialState(),
};


export const mintFeature = createFeature({
  name: 'mint',
  reducer: createReducer(
    initialState,

    // Load All Inscriptions

    on(MintActions.loadAllInscriptions, state => ({
      ...state,
      // no reset
      allInscriptionsStatus: getSubmittingState()
    })),

    on(MintActions.loadAllInscriptionsSuccess, (state, { allInscriptions }) => ({
      ...state,
      allInscriptions,
      allInscriptionsStatus: getSuccessfulState()
    })),

    on(MintActions.loadAllInscriptionsFailure, (state, { error }) => ({
      ...state,
      allInscriptionsStatus: getFailureState(error)
    })),

    // Load Inscription

    on(MintActions.loadInscription, state => ({
      ...state,
       // reset previous singleInscription to not show outdated data while loading!
       inscription: undefined,
       inscriptionStatus: getSubmittingState()
    })),

    on(MintActions.loadInscriptionSuccess, (state, { inscription }) => ({
      ...state,
      inscription,
      inscriptionStatus: getSuccessfulState()
    })),

    on(MintActions.loadInscriptionFailure, (state, { error }) => ({
      ...state,
      inscriptionStatus: getFailureState(error)
    })),

    on(MintActions.loadInscriptionFailure, (state, { error }) => ({
      ...state,
      inscriptionStatus: getFailureState(error)
    })),

    // Place Order

    on(MintActions.placeOrder, state => ({
      ...state,
      orderResponse: undefined,
      orderStatus: getSubmittingState()
    })),

    on(MintActions.placeOrderSuccess,
       MintActions.updateOrderStatus, (state, { orderResponse }) => ({
      ...state,
      orderResponse,
      orderStatus: getSuccessfulState()
    })),

    on(MintActions.placeOrderFailure, (state, { error }) => ({
      ...state,
      orderResponse: undefined,
      orderStatus: getFailureState(error)
    })),

    // delete state if it contains an outdated orderResponse
    on(routerNavigatedAction, (state, { payload: { routerState } }) => {

      if (routerState.url.includes('/order/')) {
        const urlOrderId = routerState.url.replace('/order/', '');
        if (state.orderResponse?.id !== urlOrderId) {
          return {
            ...state,
            orderResponse: undefined,
            orderStatus: getSubmittingState()
          };
        }
      }

      return state;
    }),
  )
});

export const {
  name,
  reducer,
  selectMintState,
  selectAllInscriptions,
  selectAllInscriptionsStatus,
  selectInscription,
  selectInscriptionStatus,
  selectOrderResponse,
  selectOrderStatus
} = mintFeature;
