import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { mergeMap } from 'rxjs/operators';

import { WalletService } from '../services/wallet-service';
import { WalletActions } from './wallet.actions';


@Injectable()
export class WalletEffects {

  walletService = inject(WalletService);

  connectWallet$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(WalletActions.connectWallet),
      mergeMap(() =>
        this.walletService.connect()
      )
    );
  }, { dispatch: false });
}
