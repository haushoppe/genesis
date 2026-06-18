import { inject, Injectable, NgZone } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { NotificationService } from '@progress/kendo-angular-notification';
import { forkJoin, from, interval, of, timer } from 'rxjs';
import {
  catchError,
  concatMap,
  exhaustMap,
  filter,
  map,
  mergeMap,
  retry,
  switchMap,
  takeUntil,
  tap,
  timeout,
  withLatestFrom,
} from 'rxjs/operators';

import { KnownTokenName } from '../../shared/known-token-name';
import { environment } from '../../environments/environment';
import { ApiService } from '../openapi-client';
import { multiplyWeiPrice } from '../services/ethers-utils';
import { MintService } from '../services/mint-service';
import { deepEqual } from './helper/deep-equal';
import { MintActions } from './mint.actions';
import { selectAllTokenMetadataOfWallet, selectAllTokenMetadataOfWalletStatus, selectMintTicket } from './mint.reducer';
import { PageActions } from './page.actions';
import { mapToParam, ofRoute } from './utils-ngrx-router/operators';
import { WalletActions } from './wallet.actions';
import { selectConfig } from './wallet.reducer';
import { selectProvider, selectWalletAddress } from './wallet.selectors';
import { detectTokenChanges } from './helper/detect-token-changes';
import { SubmitStatus } from './submittable/submit-status';
import { confettiFirework } from './helper/confetti-firework';


@Injectable()
export class MintEffects {

  actions = inject(Actions);
  apiService = inject(ApiService);
  mintService = inject(MintService);
  store = inject(Store);
  notificationService = inject(NotificationService);
  ngZone = inject(NgZone);

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
      concatMap(() => [
        MintActions.clearMintTicket(),
        MintActions.clearAllTokenMetadataOfWallet()
      ])
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

  startWalletPolling$ = createEffect(() => {
    return this.actions.pipe(
      ofType(WalletActions.walletStateChange),
      exhaustMap(() =>  // Start polling when startPolling action is dispatched. Ignore new startPolling actions until the current polling completes.
        timer(0, 2000).pipe(
          takeUntil(this.actions.pipe(ofType((WalletActions.disconnectWalletDetected)))),  // Stop polling when stopPolling action is dispatched.
          withLatestFrom(
            this.store.select(selectWalletAddress),
            this.store.select(selectAllTokenMetadataOfWallet),
            this.store.select(selectAllTokenMetadataOfWalletStatus)
          ),
          map(([, address, prevState, prevStatus]) => ({
            address: address || '',
            prevState,
            prevSubmitStatus: prevStatus.submitStatus
          })),
          exhaustMap(({ address, prevState, prevSubmitStatus }) =>  // Perform an HTTP request for each value emitted by the interval. Ignore new values until the HTTP request completes.
            this.apiService.allTokenMetadataOfOwner(KnownTokenName.genesis, address).pipe(
              map(newState => ({
                owned: newState.owned.reverse(),
                lended: newState.lended.reverse()
              })),
              filter(newState => !deepEqual(prevState, newState) || prevSubmitStatus === SubmitStatus.NotSubmitted),
              concatMap(newState => [
                ...(prevSubmitStatus !== SubmitStatus.NotSubmitted ?  detectTokenChanges(prevState, newState) : []),
                MintActions.loadAllTokenMetadataOfWalletSuccess({ allTokenMetadataOfWallet: newState })
              ]),
              catchError(error => of(MintActions.loadAllTokenMetadataOfWalletFailure({ error })))
            )
          )
        )
      )
    )
  });

  showNotification$ = createEffect(() => {
    return this.actions.pipe(
      ofType(
        MintActions.tokensMintedOrBought,
        MintActions.tokensSentOrSold,
        MintActions.tokensLoaned,
        MintActions.loanedTokensRetrieved
      ),
      tap(action => {
        let message = '';

        const pluralize = (amount: number, adjective = ''): string => {
          switch (amount) {
            case 1: return `one ${ adjective }element`;
            case 2: return `two ${ adjective }elements`;
            case 3: return `three ${ adjective }elements`;
            case 4: return `four ${ adjective }elements`;
            default: return `${ amount } ${ adjective }elements`;
          }
        }

        const amount = action.tokens.length;

        switch (action.type) {
          case MintActions.tokensMintedOrBought.type:
            message = `You successfully collected ${ pluralize(amount) }!`;
            break;
          case MintActions.tokensSentOrSold.type:
            message = `You successfully transferred ${ pluralize(amount) }.`;
            break;
          case MintActions.tokensLoaned.type:
            message = `You loaned out ${ pluralize(amount) }`;
            break;
          case MintActions.loanedTokensRetrieved.type:
            message = `You retrieved ${ pluralize(amount, 'loaned ') }.`;
            break;
        }

        this.notificationService.show({
          content: message,
          hideAfter: 10000,
          position: { horizontal: 'center', vertical: 'top' },
          animation: { type: 'slide', duration: 400 },
          type: { style: 'success', icon: true },
          // closable: true
        });

        if (action.type === MintActions.tokensMintedOrBought.type) {
          this.ngZone.runOutsideAngular(() => confettiFirework());
        }
      })
    )
  }, { dispatch: false });
}
