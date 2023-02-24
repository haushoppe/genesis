import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, retry, switchMap } from 'rxjs/operators';

import { KnownTokenName } from '../../../../shared/known-token-name';
import { ApiService } from '../openapi-client';
import { WalletService } from '../services/wallet-service';
import { MintActions } from './mint.actions';


@Injectable()
export class MintEffects {

  apiService = inject(ApiService);
  walletService = inject(WalletService);

  loadMints$ = createEffect(() => {
    return inject(Actions).pipe(

      ofType(MintActions.loadMints),
      switchMap(() =>
        this.apiService.allMints(KnownTokenName.genesis).pipe(
          retry({ count: 3, delay: 1000 }),
          map(x => x.reverse()),
          map(mints => MintActions.loadMintsSuccess({ mints })),
          catchError(error => of(MintActions.loadMintsFailure({ error }))))
      )
    );
  });

  connectWallet$ = createEffect(() => {
    return inject(Actions).pipe(

      ofType(MintActions.connectWallet),
      switchMap(() =>
        this.walletService.connect()
      )
    );
  }, { dispatch: false });
}
