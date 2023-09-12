import { createFeature, createReducer, on } from '@ngrx/store';

import { MintActions } from './mint.actions';


export interface State {
  pastOrders: { id: string, createdAt: string }[];
  pastCreatedInscriptions: { txId: string, createdAt: string }[];
}

export const initialState: State = {
  pastOrders: [],
  pastCreatedInscriptions: [],
};


export const pastFeature = createFeature({
  name: 'past',
  reducer: createReducer(
    initialState,


    on(MintActions.placeOrderSuccess, (state, { orderResponse, createdAt }) => ({
      ...state,
      pastOrders: [
        ...state.pastOrders,
        {
          id: orderResponse.id,
          createdAt
        }
      ]
    })),

    on(MintActions.createConnectInscriptionSuccess, (state, { inscriptionResponse, createdAt }) => ({
      ...state,
      pastCreatedInscriptions: [
        ...state.pastCreatedInscriptions,
        {
          txId: inscriptionResponse.txId,
          createdAt
        }
      ]
    }))
  )
});

export const {
  name,
  reducer,
  selectPastState,
  selectPastOrders,
  selectPastCreatedInscriptions
} = pastFeature;
