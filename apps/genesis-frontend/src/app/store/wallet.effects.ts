import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, mergeMap, withLatestFrom } from 'rxjs/operators';

import { WalletService } from '../services/wallet-service';
import { WalletActions } from './wallet.actions';
import { selectWallet } from './wallet.reducer';


@Injectable()
export class WalletEffects {

  walletService = inject(WalletService);
  store = inject(Store);

  connectWallet$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(WalletActions.connectWallet),
      mergeMap(() => this.walletService.connect()
      ),
      map(wallet => wallet ?
        WalletActions.connectWalletSuccess({ wallet }) :
        WalletActions.connectWalletFailure())
    );
  });

  disconnectWallet$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(WalletActions.disconnectWallet),
      withLatestFrom(this.store.select(selectWallet)),
      map(([_, wallet]) => wallet),
      mergeMap(wallet => {
        if (wallet) {
          return this.walletService.disconnect(wallet.label)
        }
        return Promise.resolve()
      })
      )
  }, { dispatch: false });
}
