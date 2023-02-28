import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { WalletActions } from './wallet.actions';
import { selectKnownToken, selectKnownTokenStatus, selectWallet, selectWalletStatus } from './wallet.reducer';


@Injectable({
  providedIn: 'root'
})
export class WalletFacade {

  store = inject(Store);

  knownToken$ = this.store.select(selectKnownToken);
  knownTokenStatus$ = this.store.select(selectKnownTokenStatus);

  wallet$ = this.store.select(selectWallet);
  walletStatus$ = this.store.select(selectWalletStatus);

  connectWallet() {
    this.store.dispatch(WalletActions.connectWallet());
  }

  disconnectWallet() {
    this.store.dispatch(WalletActions.disconnectWallet());
  }
}
