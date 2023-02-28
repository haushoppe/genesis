import { createFeature, createReducer, on } from '@ngrx/store';

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
  wallet: StrictWalletState | undefined;
  walletStatus: SubmittableState;
}

export const initialState: State = {
  wallet: undefined,
  walletStatus: { ...initialSubmittableState }
};


export const walletFeature = createFeature({
  name: 'wallet',
  reducer: createReducer(
    initialState,

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
  selectWallet, // selector for `wallet` property
  selectWalletStatus, // selector for `walletStatus` property
} = walletFeature;
