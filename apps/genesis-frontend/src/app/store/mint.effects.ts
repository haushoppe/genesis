import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { from, of } from 'rxjs';
import { catchError, map, mergeMap, retry, switchMap, timeout, withLatestFrom } from 'rxjs/operators';

import { KnownTokenName } from '../../../../shared/known-token-name';
import { ApiService } from '../openapi-client';
import { MintService } from '../services/mint-service';
import { MintActions } from './mint.actions';
import { WalletActions } from './wallet.actions';
import { mapToParam, ofRoute } from './utils-ngrx-router/operators';
import { selectProvider, selectWalletAddress } from './wallet.selectors';
import { selectConfig } from './wallet.reducer';
import { environment } from '../../environments/environment';


@Injectable()
export class MintEffects {

  actions = inject(Actions);
  apiService = inject(ApiService);
  mintService = inject(MintService);
  store = inject(Store)


  loadMintsOnRouting$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute(['']),
      map(() => MintActions.loadAllMints()),
    );
  });

  loadMints$ = createEffect(() => {
    return this.actions.pipe(
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
    return this.actions.pipe(
      ofRoute(['nft/:tokenId']),
      mapToParam('tokenId'),
      map(tokenId => MintActions.loadTokenInfo({ tokenId: +tokenId })),
    );
  });

  loadTokenInfo$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.loadTokenInfo),
      switchMap(({ tokenId }) =>
        this.apiService.tokenInfo(KnownTokenName.genesis, tokenId).pipe(
          retry({ count: 3, delay: 1000 }),
          map(tokenInfo => MintActions.loadTokenInfoSuccess({ tokenInfo  })),
          catchError(error => of(MintActions.loadTokenInfoFailure({ error }))))
      )
    );
  });

  triggerActionsOnWalletChange$ = createEffect(() => {
    return this.actions.pipe(
      ofType(WalletActions.walletStateChange),
      mergeMap(() => [
        MintActions.loadMintTicket(),
        MintActions.loadTotalSupply()
      ])
    );
  });

  triggerClearOnWalletDisconnect$ = createEffect(() => {
    return this.actions.pipe(
      ofType(WalletActions.disconnectWalletDetected),
      map(() => MintActions.clearMintTicket())
    );
  });

  loadMintTicket$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.loadMintTicket),
      withLatestFrom(this.store.select(selectWalletAddress)),
      map(([, address]) => address || ''),
      switchMap(address =>
        this.apiService.mintTicket({ sender: address, tokenName: KnownTokenName.genesis }).pipe(
          retry({ count: 3, delay: 1000 }),
          map(mintTicket => MintActions.loadMintTicketSuccess({ mintTicket })),
          catchError(error => of(MintActions.loadMintTicketFailure({ error }))))
      )
    );
  });


  signMessage$ = createEffect(() => {
    return this.actions.pipe(
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

  loadTotalSupply$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.loadTotalSupply),
      withLatestFrom(this.store.select(selectProvider), this.store.select(selectConfig)),
      map(([, provider, config]) => ({ provider, contractAddress: config?.contractAddress })),
      switchMap(({ provider, contractAddress }) => from(this.mintService.totalSupply(provider, contractAddress)).pipe(
        map(totalSupply => MintActions.loadTotalSupplySuccess({ totalSupply })),
        timeout(environment.web3ProviderTimeout),
        catchError(error => of(MintActions.loadTotalSupplyFailure({ error }))))
    ));
  });
}
