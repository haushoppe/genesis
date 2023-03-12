import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { WalletActions } from './wallet.actions';
import { selectKnownToken, selectKnownTokenStatus, selectWalletStatus } from './wallet.reducer';
import { selectWalletAddress, selectWalletEnsName, selectWalletLabel, selectWalletUnsName } from './wallet.selectors';


@Injectable({
  providedIn: 'root'
})
export class WalletFacade {

  store = inject(Store);

  knownToken$ = this.store.select(selectKnownToken);
  knownTokenStatus$ = this.store.select(selectKnownTokenStatus);

  // wallet$ = this.store.select(selectWallet);
  walletStatus$ = this.store.select(selectWalletStatus);
  walletLabel$ = this.store.select(selectWalletLabel);
  walletEnsName$ = this.store.select(selectWalletEnsName);
  walletUnsName$ = this.store.select(selectWalletUnsName);
  walletAddress$ = this.store.select(selectWalletAddress);

  connectWallet() {
    this.store.dispatch(WalletActions.connectWallet());
  }

  disconnectWallet() {
    this.store.dispatch(WalletActions.disconnectWallet());
  }
}
