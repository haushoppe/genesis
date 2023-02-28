import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { WalletActions } from './wallet.actions';
import { selectWallet, selectWalletStatus } from './wallet.reducer';


@Injectable({
  providedIn: 'root'
})
export class WalletFacade {

  store = inject(Store);

  wallet$ = this.store.select(selectWallet);
  walletStatus$ = this.store.select(selectWalletStatus);

  connectWallet() {
    this.store.dispatch(WalletActions.connectWallet());
  }

  disconnectWallet() {
    this.store.dispatch(WalletActions.disconnectWallet());
  }
}
