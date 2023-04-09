import { createSelector } from '@ngrx/store';
import { ethers } from 'ethers';

import { selectWallet } from './wallet.reducer';


export const selectWalletLabel = createSelector(
  selectWallet,
  wallet => wallet?.label
);

export const selectWalletEnsName = createSelector(
  selectWallet,
  wallet => {
    const name = wallet?.accounts?.[0]?.ens?.name;
    return name || undefined;
  }
);

export const selectWalletUnsName = createSelector(
  selectWallet,
  wallet => {
    const name = wallet?.accounts?.[0]?.uns?.name;
    return name || undefined;
  }
);

export const selectBestWalletName = createSelector(
  selectWalletEnsName,
  selectWalletUnsName,
  (walletEnsName, walletUnsName) => walletEnsName || walletUnsName
);

export const selectWalletAddress = createSelector(
  selectWallet,
  wallet => {
    const address = wallet?.accounts?.[0]?.address;
    return address || undefined;
  }
);

export const selectProvider = createSelector(
  selectWallet,
  wallet => {
    if (wallet) {
      const eipProvider = wallet.getProvider();
      const provider = new ethers.BrowserProvider(eipProvider, 'any');
      return provider;
    }
    return undefined;
  }
);

