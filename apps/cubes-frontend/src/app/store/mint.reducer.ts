import { createFeature, createReducer, on } from '@ngrx/store';

import { MintActions } from './mint.actions';
import {
  getFailureState,
  getInitialState,
  getSubmittingState,
  getSuccessfulState,
  SubmittableState,
} from './submittable/submittable-state';
import { Inscription, OrderResponse } from '../ordinalsbot';
import { InscriptionSimple } from '../openapi-client';

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

  orderId: string | undefined;
  orderResponse: OrderResponse | undefined;
  orderStatus: SubmittableState;
}

export const initialState: State = {
  allInscriptions: [],
  allInscriptionsStatus: getInitialState(),

  inscription: undefined,
  inscriptionStatus: getInitialState(),

  orderId: undefined,
  orderResponse: undefined,
  // orderStatus: exampleUnpaidResponse as OrderResponse,
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
      orderId: undefined,
      orderResponse: undefined,
      orderStatus: getSubmittingState()
    })),

    on(MintActions.placeOrderSuccess,
       MintActions.updateOrderStatus, (state, { orderResponse }) => ({
      ...state,
      orderId: orderResponse.charge.id,
      orderResponse,
      orderStatus: getSuccessfulState()
    })),

    on(MintActions.placeOrderFailure, (state, { error }) => ({
      ...state,
      orderId: undefined,
      orderResponse: undefined,
      orderStatus: getFailureState(error)
    }))
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
  selectOrderId,
  selectOrderResponse,
  selectOrderStatus
} = mintFeature;
