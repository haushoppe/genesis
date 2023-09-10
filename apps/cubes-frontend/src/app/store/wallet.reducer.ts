import { createFeature, createReducer, on } from '@ngrx/store';

import {
  getFailureState,
  getInitialState,
  getSubmittingState,
  getSuccessfulState,
  SubmittableState,
} from './submittable/submittable-state';
import { WalletActions } from './wallet.actions';

export interface WalletInfo {
  label: string;
  ordinalsAddress: string;
  useConnectInscription: boolean;
}

export interface State {
  installedWallets: { label: string; logo: string; }[] | undefined;
  wallet: WalletInfo | undefined;
  walletStatus: SubmittableState;
}

export const initialState: State = {
  installedWallets: undefined,
  wallet: undefined,
  walletStatus: getInitialState()
};


export const walletFeature = createFeature({
  name: 'wallet',
  reducer: createReducer(
    initialState,

    // Check Installed Wallets

    on(WalletActions.installedWalletsChanged, (state, { installedWallets }) => ({
      ...state,
      installedWallets
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

    on(WalletActions.connectWalletFailure, (state, { message }) => ({
      ...state,
      wallet: undefined,
      walletStatus: getFailureState({ message })
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
  selectInstalledWallets,
  selectWalletState,
  selectWallet, // selector for `wallet` property
  selectWalletStatus, // selector for `walletStatus` property
} = walletFeature;
