import { createSelector } from '@ngrx/store';

import { selectWallet } from './wallet.reducer';

export const selectWalletAddress = createSelector(
  selectWallet,
  wallet => {
    const address = wallet?.ordinalsAddress;
    return address || undefined;
  }
);

export function addressIsCurrentWallet(address: string | undefined) {

  return createSelector(
    selectWalletAddress,
    walletAddress => {
      if (!walletAddress || !address) { return false; }
      return walletAddress.toLowerCase() === address.toLowerCase();
    }
  );
}
