import { createSelector } from '@ngrx/store';
import { ethers } from 'ethers';

import { selectWallet } from './wallet.reducer';


export const selectLabel = createSelector(
  selectWallet,
  wallet => wallet?.label
);

export const selectProvider = createSelector(
  selectWallet,
  wallet => {
    if (wallet) {
      const eipProvider = wallet.getProvider();
      return new ethers.providers.Web3Provider(eipProvider, 'any');
    }
    return undefined;
  }
);

