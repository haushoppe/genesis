import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { WalletActions } from './wallet.actions';


@Injectable({
  providedIn: 'root'
})
export class WalletFacade {

  store = inject(Store);

  connectWallet() {
    this.store.dispatch(WalletActions.connectWallet());
  }
}
