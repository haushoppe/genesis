import { inject, Injectable } from '@angular/core';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';

import { ApiService } from '../openapi-client';
import { WalletService } from '../services/wallet-service';


@Injectable()
export class WalletEffects {

  actions = inject(Actions);
  apiService = inject(ApiService);
  walletService = inject(WalletService);
  store = inject(Store);


  // connectWallet$ = createEffect(() => {
  //   return this.actions.pipe(
  //     ofType(WalletActions.connectWallet),
  //     withLatestFrom(this.store.select(selectConfig)),
  //     map(([, knownToken]) => knownToken),
  //     mergeMap(knownToken => this.walletService.connect(knownToken?.networkConfig)),
  //     map(wallet => wallet ?
  //       WalletActions.connectWalletSuccess({ wallet }) :
  //       WalletActions.connectWalletFailure())
  //   );
  // });

  // disconnectWallet$ = createEffect(() => {
  //   return this.actions.pipe(
  //     ofType(WalletActions.disconnectWallet),
  //     withLatestFrom(this.store.select(selectWallet)),
  //     map(([, wallet]) => wallet),
  //     mergeMap(wallet => this.walletService.disconnect(wallet?.label)),
  //     // we will use disconnectWalletDetected which is always triggered
  //     // map(() => WalletActions.disconnectWalletDone())
  //   );
  // }, { dispatch: false });
}
