import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType, OnInitEffects } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, mergeMap, pairwise, retry, tap, withLatestFrom } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ApiService } from '../openapi-client';

import { WalletService } from '../services/wallet-service';
import { WalletActions } from './wallet.actions';
import { selectKnownToken, selectWallet } from './wallet.reducer';


@Injectable()
export class WalletEffects implements OnInitEffects {

  apiService = inject(ApiService);
  walletService = inject(WalletService);
  store = inject(Store);

  loadTokenConfig$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(WalletActions.loadTokenConfig),
      mergeMap(() => this.apiService.status(environment.tokenName).pipe(
        retry({
          count: 3,
          delay: 1000
        }),
        map(backendStatus => WalletActions.loadTokenConfigSuccess({ knownToken: backendStatus.knownTokens[0] })),
        catchError(error => of(WalletActions.loadTokenConfigFailure({ error }))))
      )
    );
  });

  createOnboardInstance$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(WalletActions.loadTokenConfigSuccess),
      map(({ knownToken }) => this.walletService.createOnboardInstance(knownToken.networkConfig))
    );
  }, { dispatch: false });

  connectWallet$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(WalletActions.connectWallet),
      withLatestFrom(this.store.select(selectKnownToken)),
      map(([, knownToken]) => knownToken),
      mergeMap(knownToken => this.walletService.connect(knownToken?.networkConfig)),
      map(wallet => wallet ?
        WalletActions.connectWalletSuccess({ wallet }) :
        WalletActions.connectWalletFailure())
    );
  });

  disconnectWallet$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(WalletActions.disconnectWallet),
      withLatestFrom(this.store.select(selectWallet)),
      map(([, wallet]) => wallet),
      mergeMap(wallet => this.walletService.disconnect(wallet?.label)),
      map(() => WalletActions.disconnectWalletDone())
    );
  });

  walletStateChange$ = createEffect(() => {
    return this.walletService.walletStateChange$.pipe(

      // emits the current element along with the previous one
      // see https://thecompetentdev.com/weeklyjstips/tips/44_rxjs_filter_with_prev/
      pairwise(),
      // filter out all changes from undefined to wallet, which happens after a connect
      filter(([prev, element]) => prev !== undefined),
      map(([prev, element]) => element),

      // and now we also make sure that we don't get identical events
      distinctUntilChanged((prev, curr) => {
        return JSON.stringify(prev) === JSON.stringify(curr);
      }),
      map(wallet => wallet ?
        WalletActions.walletStateChange({ wallet }) :
        WalletActions.disconnectWalletDetected())
    );
  });

  cleanupAfterDisconnectWalletDetected$ = createEffect(() => {
    return inject(Actions).pipe(
      ofType(WalletActions.disconnectWalletDetected),
      map(() => this.walletService.cleanupAfterDisconnect())
    );
  }, { dispatch: false });

  ngrxOnInitEffects() {
    return WalletActions.loadTokenConfig();
  }
}
