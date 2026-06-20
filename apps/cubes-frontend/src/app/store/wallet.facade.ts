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

  // Signal-based selectors (NgRx 21 selectSignal — preferred for new code
  // and for template consumption via direct call syntax `signal()`).
  walletStatus = this.store.selectSignal(selectWalletStatus);
  walletAddress = this.store.selectSignal(selectWalletAddress);
  useConnectInscription = this.store.selectSignal(selectUseConnectInscription);
  xverseInstalled = this.store.selectSignal(selectXverseInstalled);
  xverseConnected = this.store.selectSignal(selectXverseConnected);

  // Observable variants (legacy — still used by templates that haven't
  // been migrated off *rxLet / | async yet). Will be removed once every
  // consumer is on the Signal path.
  walletStatus$ = this.store.select(selectWalletStatus);
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
