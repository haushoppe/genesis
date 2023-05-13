import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { EMPTY, forkJoin, from, interval, of } from 'rxjs';
import { catchError, concatMap, exhaustMap, map, mergeMap, retry, switchMap, takeUntil, timeout, withLatestFrom } from 'rxjs/operators';

import { KnownTokenName } from '../../../../shared/known-token-name';
import { environment } from '../../environments/environment';
import { ApiService } from '../openapi-client';
import { MintService } from '../services/mint-service';
import { MintActions } from './mint.actions';
import { selectMintTicket } from './mint.reducer';
import { mapToParam, ofRoute } from './utils-ngrx-router/operators';
import { WalletActions } from './wallet.actions';
import { selectConfig } from './wallet.reducer';
import { selectProvider, selectWalletAddress } from './wallet.selectors';
import { PageActions } from './page.actions';
import { multiplyWeiPrice } from '../services/ethers-utils';


@Injectable()
export class MintEffects {

  actions = inject(Actions);
  apiService = inject(ApiService);
  mintService = inject(MintService);
  store = inject(Store)


  loadMintsOnRouting$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute(['']),
      map(() => MintActions.loadAllTokenMetadata()),
    );
  });

  loadMints$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.loadAllTokenMetadata),
      switchMap(() =>
        this.apiService.allTokenMetadata(KnownTokenName.genesis).pipe(
          retry({ count: 3, delay: 1000 }),
          map(x => x.reverse()),
          concatMap(allTokenMetadata => [
            MintActions.loadAllTokenMetadataSuccess({ allTokenMetadata }),
            PageActions.ready()
          ]),
          catchError(error => of(MintActions.loadAllTokenMetadataFailure({ error }))))
      )
    );
  });

  loadTokenMetadataOnRouting$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute(['nft/:tokenId']),
      mapToParam('tokenId'),
      map(tokenId => MintActions.loadTokenMetadata({ tokenId: +tokenId })),
    );
  });

  loadTokenMetadata$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.loadTokenMetadata),
      switchMap(({ tokenId }) =>
        forkJoin([
          this.apiService.tokenMetadata(KnownTokenName.genesis, tokenId),
          this.apiService.tokenOwner(KnownTokenName.genesis, tokenId)
        ]).pipe(
          map(([metadata, owner]) => ({ metadata, owner })),
          retry({ count: 3, delay: 1000 }),
          concatMap(tokenMetadataAndOwner => [
            MintActions.loadTokenMetadataSuccess({ tokenMetadataAndOwner }),
            PageActions.ready()
          ]),
          catchError(error => of(MintActions.loadTokenMetadataFailure({ error }))))
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

  mintAllowlist$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.mintAllowlist),
      withLatestFrom(this.store.select(selectProvider), this.store.select(selectConfig), this.store.select(selectMintTicket)),
      map(([{ mintNumber }, provider, config, mintTicket]) => ({
        provider,
        contractAddress: config?.contractAddress,
        mintNumber,
        price: multiplyWeiPrice(config?.price || '0', mintNumber),
        mintTicket
      })),
      switchMap(({ provider, contractAddress, mintNumber, price, mintTicket }) => from(this.mintService.mintAllowlist(
        provider,
        contractAddress,
        mintNumber,
        price,
        mintTicket
      )).pipe(
        map(() => MintActions.mintAllowlistSuccess()),
        catchError(error => of(MintActions.mintAllowlistFailure({ error }))))
      ));
  });

  startPolling$ = createEffect(() => {
    return this.actions.pipe(
      ofType(WalletActions.walletStateChange),
      exhaustMap(() =>  // Start polling when startPolling action is dispatched. Ignore new startPolling actions until the current polling completes.
        interval(2000).pipe(  // Emit a value every 2 seconds.
          takeUntil(this.actions.pipe(ofType((WalletActions.disconnectWalletDetected)))),  // Stop polling when stopPolling action is dispatched.
          withLatestFrom(this.store.select(selectWalletAddress)),
          map(([, address]) => address || ''),
          exhaustMap(address =>  // Perform an HTTP request for each value emitted by the interval. Ignore new values until the HTTP request completes.
            this.apiService.allTokenMetadataOfOwner(KnownTokenName.genesis, address).pipe(
              map(allTokenMetadataOfOwner => {
                // // Check for a special result and dispatch a new action
                // if (data['specialResult']) {
                //   return actions.processHttpResult({ data });
                // } else {
                //   // If the result isn't special, just return an empty action
                //   return { type: 'NO_ACTION' };
                // }
                return MintActions.ownedTokensChanged({ allTokenMetadataOfOwner })
              }),
              catchError(error => EMPTY),  // Handle errors to avoid stopping the polling.
            )
          )
        )
      )
    )
  });

}
