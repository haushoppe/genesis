import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { WalletActions } from './wallet.actions';


@Injectable({
  providedIn: 'root'
})
export class WalletFacade {

  store = inject(Store);

  // walletStatus$ = this.store.select(selectWalletStatus);
  // walletLabel$ = this.store.select(selectWalletLabel);
  // bestWalletName$ = this.store.select(selectBestWalletName);
  // walletAddress$ = this.store.select(selectWalletAddress);

  // addressIsCurrentWallet(address: string | undefined) {
  //   return this.store.select(addressIsCurrentWallet(address));
  // }

  connectWallet() {
    this.store.dispatch(WalletActions.connectWallet());
  }

  disconnectWallet() {
    this.store.dispatch(WalletActions.disconnectWallet());
  }

}
