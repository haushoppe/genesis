import { inject, Injectable, NgZone } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { NotificationService } from '@progress/kendo-angular-notification';
import { forkJoin, of } from 'rxjs';
import { catchError, concatMap, map, retry, switchMap } from 'rxjs/operators';

import { KnownTokenName } from '../../../../shared/known-token-name';
import { ApiService } from '../openapi-client';
import { MintService } from '../services/mint-service';
import { MintActions } from './mint.actions';
import { PageActions } from './page.actions';
import { mapToParam, ofRoute } from './utils-ngrx-router/operators';


@Injectable()
export class MintEffects {

  actions = inject(Actions);
  apiService = inject(ApiService);
  mintService = inject(MintService);
  store = inject(Store);
  notificationService = inject(NotificationService);
  ngZone = inject(NgZone);

  // loadMintsOnRouting$ = createEffect(() => {
  //   return this.actions.pipe(
  //     ofRoute(['']),
  //     map(() => MintActions.loadAllTokenMetadata()),
  //   );
  // });

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



  /*
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
  */
}
