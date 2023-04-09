import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { from, of } from 'rxjs';
import { catchError, map, mergeMap, retry, switchMap, timeout, withLatestFrom } from 'rxjs/operators';

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
          map(allTokenMetadata => MintActions.loadAllTokenMetadataSuccess({ allTokenMetadata })),
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
        this.apiService.tokenMetadata(KnownTokenName.genesis, tokenId).pipe(
          retry({ count: 3, delay: 1000 }),
          map(tokenMetadata => MintActions.loadTokenMetadataSuccess({ tokenMetadata })),
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
      map(([action, provider, config, mintTicket]) => ({
        provider,
        contractAddress: config?.contractAddress,
        mintNumber: action.mintNumber,
        price: config?.price || '0',
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

}
