import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, retry, switchMap, withLatestFrom } from 'rxjs/operators';

import { KnownTokenName } from '../../../../shared/known-token-name';
import { ApiService } from '../openapi-client';
import { MintService } from '../services/mint-service';
import { MintActions } from './mint.actions';
import { mapToParam, ofRoute } from './utils-ngrx-router/operators';
import { selectProvider } from './wallet.selectors';


@Injectable()
export class MintEffects {

  apiService = inject(ApiService);
  mintService = inject(MintService);
  store = inject(Store)


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

  signMessage$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(MintActions.signMessage),
      withLatestFrom(this.store.select(selectProvider)),
      map(([, provider]) => provider),
      switchMap(provider => this.mintService.signMessage(provider)),
      map(validMessage => validMessage ?
        MintActions.signMessageSuccess() :
        MintActions.signMessageFailure()
      )
    );
  });
}
