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

  walletStatus = this.store.selectSignal(selectWalletStatus);
  walletAddress = this.store.selectSignal(selectWalletAddress);
  useConnectInscription = this.store.selectSignal(selectUseConnectInscription);
  xverseInstalled = this.store.selectSignal(selectXverseInstalled);
  xverseConnected = this.store.selectSignal(selectXverseConnected);

  addressIsCurrentWallet(address: string | undefined) {
    return this.store.selectSignal(addressIsCurrentWallet(address));
  }

  connectWallet() {
    this.store.dispatch(WalletActions.connectWallet());
  }

  disconnectWallet() {
    this.store.dispatch(WalletActions.disconnectWallet());
  }

}
