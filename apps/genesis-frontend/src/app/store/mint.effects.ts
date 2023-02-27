import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap, retry, switchMap } from 'rxjs/operators';

import { KnownTokenName } from '../../../../shared/known-token-name';
import { ApiService } from '../openapi-client';
import { WalletService } from '../services/wallet-service';
import { MintActions } from './mint.actions';
import { mapToParam, ofRoute } from './utils-ngrx-router/operators';


@Injectable()
export class MintEffects {

  apiService = inject(ApiService);
  walletService = inject(WalletService);

  loadMintsOnRouting$ = createEffect(() => {
    return inject(Actions).pipe(
      ofRoute(['']),
      map(() => MintActions.loadAllMints()),
    );
  });

  loadMints$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(MintActions.loadAllMints),
      switchMap(() =>
        this.apiService.allMints(KnownTokenName.genesis).pipe(
          retry({ count: 3, delay: 1000 }),
          map(x => x.reverse()),
          map(allMints => MintActions.loadAllMintsSuccess({ allMints })),
          catchError(error => of(MintActions.loadAllMintsFailure({ error }))))
      )
    );
  });

  loadTokenInfoOnRouting$ = createEffect(() => {
    return inject(Actions).pipe(
      ofRoute(['nft/:tokenId']),
      mapToParam('tokenId'),
      map(tokenId => MintActions.loadTokenInfo({ tokenId: +tokenId })),
    );
  });

  loadTokenInfo$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(MintActions.loadTokenInfo),
      switchMap(({ tokenId }) =>
        this.apiService.tokenInfo(KnownTokenName.genesis, tokenId).pipe(
          retry({ count: 3, delay: 1000 }),
          map(tokenInfo => MintActions.loadTokenInfoSuccess({ tokenInfo  })),
          catchError(error => of(MintActions.loadTokenInfoFailure({ error }))))
      )
    );
  });

  connectWallet$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(MintActions.connectWallet),
      mergeMap(() =>
        this.walletService.connect()
      )
    );
  }, { dispatch: false });
}
