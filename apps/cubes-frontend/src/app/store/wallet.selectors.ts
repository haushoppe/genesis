import { createSelector } from '@ngrx/store';

import { selectInstalledWallets, selectWallet } from './wallet.reducer';
import { KnownOrdinalWallets } from '../services/wallet-service';

export const selectWalletAddress = createSelector(
  selectWallet,
  wallet => {
    const address = wallet?.ordinalsAddress;
    return address || undefined;
  }
);

export const selectUseConnectInscription = createSelector(
  selectWallet,
  wallet => {
    return !!wallet?.useConnectInscription;
  }
);

export const selectXverseInstalled = createSelector(
  selectInstalledWallets,
  installedWallets => {
    if (!installedWallets) {
      return false;
    }

    return !!installedWallets.find(x => x.label === KnownOrdinalWallets.xverse.label);
  }
);

export const selectXverseConnected = createSelector(
  selectWallet,
  wallet => {
    if (!wallet) {
      return false;
    }

    return wallet.label === KnownOrdinalWallets.xverse.label;
  }
);
