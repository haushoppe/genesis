import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, concatMap, distinctUntilChanged, interval, map, of, switchMap, take } from 'rxjs';

import { WalletService } from '../services/wallet-service';
import { WalletActions } from './wallet.actions';


@Injectable()
export class WalletEffects {

  actions = inject(Actions);
  walletService = inject(WalletService);
  store = inject(Store);

  checkInstalledWallets$ = createEffect(() =>
    interval(500) // Start immediately and repeat every 500ms
    .pipe(
      take(4), // Take 4 intervals only, i.e., perform the check four times
      map(() => this.walletService.getInstalledWallets()),
      distinctUntilChanged((prev, curr) => {
        return JSON.stringify(prev) === JSON.stringify(curr);
      }),
      map(installedWallets => WalletActions.installedWalletsChanged({ installedWallets }))
    )
  );

  connectWallet$ = createEffect(() => {
    return this.actions.pipe(
      ofType(WalletActions.connectWallet),
      concatMap(() => this.walletService.connect().pipe(
        map(wallet => WalletActions.connectWalletSuccess({ wallet })),
        catchError(error => of(WalletActions.connectWalletFailure({ message: error?.message || '' })))),
      )
    )
  });

  disconnectWallet$ = createEffect(() => {
    return this.actions.pipe(
      ofType(WalletActions.disconnectWallet),
      switchMap(() => this.walletService.disconnect()),
    );
  }, { dispatch: false });
}
