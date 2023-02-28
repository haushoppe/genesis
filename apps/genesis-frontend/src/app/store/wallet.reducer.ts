import { createFeature, createReducer, on } from '@ngrx/store';
import { KnownTokenResponse } from '../openapi-client';

import { StrictWalletState } from './helper/strict-wallet-state';
import {
  getFailureState,
  getSubmittingState,
  getSuccessfulState,
  initialSubmittableState,
  SubmittableState,
} from './submittable/submittable-state';
import { WalletActions } from './wallet.actions';

export interface State {
  knownToken: KnownTokenResponse | undefined;
  knownTokenStatus: SubmittableState;

  wallet: StrictWalletState | undefined;
  walletStatus: SubmittableState;
}

export const initialState: State = {
  knownToken: undefined,
  knownTokenStatus:  { ...initialSubmittableState },

  wallet: undefined,
  walletStatus: { ...initialSubmittableState }
};


export const walletFeature = createFeature({
  name: 'wallet',
  reducer: createReducer(
    initialState,

    // Known Token Config

    on(WalletActions.loadTokenConfig, state => ({
      ...state,
      knownToken: undefined,
      knownTokenStatus: getSubmittingState()
    })),

    on(WalletActions.loadTokenConfigSuccess, (state, { knownToken }) => ({
      ...state,
      knownToken,
      knownTokenStatus: getSuccessfulState()
    })),

    on(WalletActions.loadTokenConfigFailure, (state,{ error }) => ({
      ...state,
      knownToken: undefined,
      knownTokenStatus: getFailureState(error.message)
    })),

    // Wallet

    on(WalletActions.connectWallet, state => ({
      ...state,
      wallet: undefined,
      walletStatus: getSubmittingState()
    })),

    on(WalletActions.connectWalletSuccess, (state, { wallet }) => ({
      ...state,
      wallet,
      walletStatus: getSuccessfulState()
    })),

    on(WalletActions.connectWalletFailure, state => ({
      ...state,
      wallet: undefined,
      walletStatus: getFailureState('No wallet was connected')
    })),

    on(WalletActions.disconnectWalletDone, state => ({
      ...state,
      wallet: undefined,
      walletStatus: { ...initialSubmittableState }
    }))
  )
});

export const {
  name, // feature name
  reducer, // feature reducer
  selectWalletState, // feature selector
  selectKnownToken, // selector for `knownToken` property
  selectKnownTokenStatus, // selector for `knownTokenStatus` property
  selectWallet, // selector for `wallet` property
  selectWalletStatus, // selector for `walletStatus` property
} = walletFeature;
