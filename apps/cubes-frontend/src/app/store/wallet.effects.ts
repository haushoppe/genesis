import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';

import { WalletService } from '../services/wallet-service';
import { map, mergeMap, withLatestFrom } from 'rxjs';
import { WalletActions } from './wallet.actions';


@Injectable()
export class WalletEffects {

  actions = inject(Actions);
  walletService = inject(WalletService);
  store = inject(Store);


  connectWallet$ = createEffect(() => {
    return this.actions.pipe(
      ofType(WalletActions.connectWallet),
      mergeMap(() => this.walletService.connect()),
      map(({ wallet, error }) => wallet ?
        WalletActions.connectWalletSuccess({ wallet }) :
        WalletActions.connectWalletFailure({ message: error?.message || '' }))
    );
  });

  disconnectWallet$ = createEffect(() => {
    return this.actions.pipe(
      ofType(WalletActions.disconnectWallet),
      mergeMap(() => this.walletService.disconnect()),
    );
  }, { dispatch: false });
}
