import { createFeature, createReducer, on } from '@ngrx/store';
import { ConfigDetails } from '../openapi-client';

import { StrictWalletState } from './helper/strict-wallet-state';
import {
  getFailureState,
  getInitialState,
  getSubmittingState,
  getSuccessfulState,
  SubmittableState,
} from './submittable/submittable-state';
import { WalletActions } from './wallet.actions';

export interface State {
  config: ConfigDetails | undefined;
  configStatus: SubmittableState;

  wallet: StrictWalletState | undefined;
  walletStatus: SubmittableState;
}

export const initialState: State = {
  config: undefined,
  configStatus:  getInitialState(),

  wallet: undefined,
  walletStatus: getInitialState()
};


export const walletFeature = createFeature({
  name: 'wallet',
  reducer: createReducer(
    initialState,

    // Config

    on(WalletActions.loadConfig, state => ({
      ...state,
      config: undefined,
      configStatus: getSubmittingState()
    })),

    on(WalletActions.loadConfigSuccess, (state, { config }) => ({
      ...state,
      config,
      configStatus: getSuccessfulState()
    })),

    on(WalletActions.loadConfigFailure, (state,{ error }) => ({
      ...state,
      config: undefined,
      configStatus: getFailureState(error)
    })),

    // Wallet

    on(WalletActions.connectWallet, state => ({
      ...state,
      wallet: undefined,
      walletStatus: getSubmittingState()
    })),

    on(WalletActions.connectWalletSuccess,
       WalletActions.walletStateChange, (state, { wallet }) => ({
      ...state,
      wallet,
      walletStatus: getSuccessfulState()
    })),

    on(WalletActions.connectWalletFailure, state => ({
      ...state,
      wallet: undefined,
      walletStatus: getFailureState({ message: 'No wallet was connected' })
    })),

    on(WalletActions.disconnectWalletDone,
       WalletActions.disconnectWalletDetected, state => ({
      ...state,
      wallet: undefined,
      walletStatus: getInitialState()
    })),
  )
});

export const {
  name, // feature name
  reducer, // feature reducer
  selectWalletState, // feature selector
  selectConfig, // selector for `config` property
  selectConfigStatus, // selector for `configStatus` property
  selectWallet, // selector for `wallet` property
  selectWalletStatus, // selector for `walletStatus` property
} = walletFeature;
