import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { WalletActions } from './wallet.actions';
import { selectWalletStatus } from './wallet.reducer';
import { addressIsCurrentWallet, selectUseConnectInscription, selectWalletAddress, selectXverseConnected, selectXverseInstalled } from './wallet.selectors';


@Injectable({
  providedIn: 'root'
})
export class WalletFacade {

  store = inject(Store);

  walletStatus$ = this.store.select(selectWalletStatus);
  // walletLabel$ = this.store.select(selectWalletLabel);
  walletAddress$ = this.store.select(selectWalletAddress);

  useConnectInscription$ = this.store.select(selectUseConnectInscription);
  xverseInstalled$ = this.store.select(selectXverseInstalled);
  xverseConnected$ = this.store.select(selectXverseConnected);

  addressIsCurrentWallet(address: string | undefined) {
    return this.store.select(addressIsCurrentWallet(address));
  }

  connectWallet() {
    this.store.dispatch(WalletActions.connectWallet());
  }

  disconnectWallet() {
    this.store.dispatch(WalletActions.disconnectWallet());
  }

}
