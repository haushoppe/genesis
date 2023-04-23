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
    let name = wallet?.accounts?.[0]?.ens?.name;

    // just for debugging, can be removed later on
    if (wallet?.accounts?.[0]?.address === '0x8c11c53f77ad5e91fb13611904f2f59b07aa7c93') {

      name = 'johanneshoppe.eth'
    }
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

