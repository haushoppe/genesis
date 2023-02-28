/* eslint-disable @typescript-eslint/no-empty-function */
import { createSelector } from '@ngrx/store';
import { ethers } from 'ethers';

import * as walletFeature from './wallet.reducer';


export const selectLabel = createSelector(
  walletFeature.selectWallet,
  wallet => wallet?.label
);

export const selectProvider = createSelector(
  walletFeature.selectWallet,
  wallet => {
    if (wallet) {
      const eipProvider = wallet.getProvider();
      return new ethers.providers.Web3Provider(eipProvider, 'any');
    }
    return undefined;
  }
);


// export const selectProvider = () => {
//   noMemoizedSelector(
//     walletFeature.selectWallet,
//     (state: StrictWalletState | undefined) => {
//       if (state) {

//         const eipProvider = state.getProvider();

//         // create an ethers provider with the last connected wallet provider
//         const ethersProvider = new ethers.providers.Web3Provider(eipProvider, 'any')

//         return ethersProvider;
//       }

//       return undefined;
//     }
//   )
// }

