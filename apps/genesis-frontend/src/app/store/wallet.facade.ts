import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { WalletActions } from './wallet.actions';
import { selectConfig, selectConfigStatus, selectWalletStatus } from './wallet.reducer';
import { selectBestWalletName, selectWalletAddress, selectWalletLabel } from './wallet.selectors';


@Injectable({
  providedIn: 'root'
})
export class WalletFacade {

  store = inject(Store);

  config$ = this.store.select(selectConfig);
  configStatus$ = this.store.select(selectConfigStatus);

  walletStatus$ = this.store.select(selectWalletStatus);
  walletLabel$ = this.store.select(selectWalletLabel);
  bestWalletName$ = this.store.select(selectBestWalletName);
  walletAddress$ = this.store.select(selectWalletAddress);

  connectWallet() {
    this.store.dispatch(WalletActions.connectWallet());
  }

  disconnectWallet() {
    this.store.dispatch(WalletActions.disconnectWallet());
  }
}
