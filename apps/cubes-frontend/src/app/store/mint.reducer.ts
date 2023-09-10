import { routerNavigatedAction } from '@ngrx/router-store';
import { createFeature, createReducer, on } from '@ngrx/store';

import { InscriptionSimple, Price } from '../openapi-client';
import { Inscription, InscriptionOrder } from '../ordinalsbot';
import { MintActions } from './mint.actions';
import {
  getFailureState,
  getInitialState,
  getSubmittingState,
  getSuccessfulState,
  SubmittableState,
} from './submittable/submittable-state';
import { CreateInscriptionResponse } from 'sats-connect';


export interface State {
  allInscriptions: InscriptionSimple[];
  allInscriptionsStatus: SubmittableState;

  // info about one single inscription, used for the details page
  inscription: Inscription | undefined;
  inscriptionStatus: SubmittableState;

  orderResponse: InscriptionOrder | undefined;
  orderStatus: SubmittableState;

  createInscriptionResponse: CreateInscriptionResponse | undefined;
  createInscriptionStatus: SubmittableState;

  knownInscriptionIds: { [inscriptionNumber: string]: string };
  knownInscriptionIdStatus: SubmittableState;

  price: Price | undefined;
  priceStatus: SubmittableState;
}

export const initialState: State = {
  allInscriptions: [],
  allInscriptionsStatus: getInitialState(),

  inscription: undefined,
  inscriptionStatus: getInitialState(),

  orderResponse: undefined,
  // orderResponse: examplePaidResponse as OrderResponse,
  // orderResponse: exampleUnpaidResponse as OrderResponse,
  orderStatus: getInitialState(),

  createInscriptionResponse: undefined,
  createInscriptionStatus:getInitialState(),

  knownInscriptionIds: {},
  knownInscriptionIdStatus: getInitialState(),

  price: undefined,
  priceStatus: getInitialState(),};


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

    on(MintActions.orderNotFound, (state, { error }) => ({
     ...state,
     orderResponse: undefined,
     orderStatus: getFailureState(error)
    })),

    on(MintActions.placeOrderFailure, (state, { error }) => ({
      ...state,
      orderResponse: undefined,
      orderStatus: getFailureState(error)
    })),

    // Sats Connect Inscription (Xverse)

    on(MintActions.createConnectInscription, state => ({
      ...state,
      createInscriptionResponse: undefined,
      createInscriptionStatus: getSubmittingState()
    })),

    on(MintActions.createConnectInscriptionSuccess, (state, { inscriptionResponse }) => ({
      ...state,
      createInscriptionResponse: inscriptionResponse,
      createInscriptionStatus: getSuccessfulState()
    })),

    on(MintActions.createConnectInscriptionFailure, (state, { error }) => ({
      ...state,
      createInscriptionResponse: undefined,
      createInscriptionStatus: getFailureState(error)
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

    // Lookup Inscription Id

    on(MintActions.lookupInscriptionId, state => ({
      ...state,
      knownInscriptionIdStatus: getSubmittingState()
    })),

    on(MintActions.lookupInscriptionIdSuccess, (state, { inscriptionNumber, inscriptionId }) => ({
      ...state,
      knownInscriptionIds: {
        ... state.knownInscriptionIds,
        [inscriptionNumber]: inscriptionId
      },
      knownInscriptionIdStatus: getSuccessfulState()
    })),

    on(MintActions.lookupInscriptionIdFailure, (state, { error }) => ({
      ...state,
      knownInscriptionIdStatus: getFailureState(error)
    })),

    // Load Price

    on(MintActions.loadPrice, state => ({
      ...state,
      priceStatus: getSubmittingState()
    })),

    on(MintActions.loadPriceSuccess, (state, { price }) => ({
      ...state,
      price,
      priceStatus: getSuccessfulState()
    })),

    on(MintActions.loadPriceFailure, (state, { error }) => ({
      ...state,
      priceStatus: getFailureState(error)
    })),
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
  selectOrderStatus,
  selectKnownInscriptionIds,
  selectKnownInscriptionIdStatus,
  selectPrice,
  selectPriceStatus
} = mintFeature;
