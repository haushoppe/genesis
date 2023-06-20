import { createFeature, createReducer, on } from '@ngrx/store';

import {
  getFailureState,
  getInitialState,
  getSubmittingState,
  getSuccessfulState,
  SubmittableState,
} from './submittable/submittable-state';
import { WalletActions } from './wallet.actions';

export interface State {
  wallet: string | undefined;
  walletStatus: SubmittableState;
}

export const initialState: State = {
  wallet: undefined,
  walletStatus: getInitialState()
};


export const walletFeature = createFeature({
  name: 'wallet',
  reducer: createReducer(
    initialState,

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
      walletStatus: getFailureState({ message: 'No wallet was connected' })
    })),

    on(WalletActions.disconnectWallet, state => ({
      ...state,
      wallet: undefined,
      walletStatus: getInitialState()
    })),
  )
});

export const {
  name,
  reducer,
  selectWalletState,
  selectWallet, // selector for `wallet` property
  selectWalletStatus, // selector for `walletStatus` property
} = walletFeature;
