import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { WalletActions } from './wallet.actions';
import { selectWalletStatus } from './wallet.reducer';
import { selectUseConnectInscription, selectWalletAddress, selectXverseConnected, selectXverseInstalled } from './wallet.selectors';


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

  connectWallet() {
    this.store.dispatch(WalletActions.connectWallet());
  }

  disconnectWallet() {
    this.store.dispatch(WalletActions.disconnectWallet());
  }

}
