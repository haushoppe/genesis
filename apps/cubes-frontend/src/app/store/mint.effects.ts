import { inject, Injectable, NgZone } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { NotificationService } from '@progress/kendo-angular-notification';
import { defer, EMPTY, from, interval, of } from 'rxjs';
import { catchError, concatMap, exhaustMap, filter, map, retry, switchMap, takeUntil, tap, withLatestFrom } from 'rxjs/operators';

import { OrdinalsService } from '../openapi-client';
import { InscriptionOrder, OrderResponse } from '../ordinalsbot';
import { MempoolService } from '../services/mempool-service';
import { MintService } from '../services/mint-service';
import { confettiFirework } from './helper/confetti-firework';
import { limitArray } from './helper/limit-array';
import { MintActions } from './mint.actions';
import { PageActions } from './page.actions';
import { mapToParam, ofRoute } from './utils-ngrx-router/operators';
import { Router } from '@angular/router';
import { selectKnownInscriptionIds } from './mint.reducer';





@Injectable()
export class MintEffects {

  actions = inject(Actions);
  ordinalsService = inject(OrdinalsService);
  mintService = inject(MintService);
  mempoolService = inject(MempoolService);
  store = inject(Store);
  notificationService = inject(NotificationService);
  ngZone = inject(NgZone);
  router = inject(Router);

  placeOrder$ = createEffect(() =>
    this.actions.pipe(
      ofType(MintActions.placeOrder),
      concatMap(({ receiveAddress, inscriptionIds, code }) =>
        defer(() => from(this.mintService.getFees())).pipe(
          retry({ count: 3, delay: 1000 }),
          switchMap(fees =>
            this.mintService.placeOrder(receiveAddress, inscriptionIds, fees.halfHourFee, code).pipe(
              tap(orderResponse => this.router.navigate(['/order', orderResponse.id])),
              map(orderResponse => MintActions.placeOrderSuccess({ orderResponse })),
              catchError(error => of(MintActions.placeOrderFailure({ error })))
            )
          )
        )
      )
    )
  );

  startOrderPolling$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute(['order/:orderId']),
      mapToParam('orderId'),
      switchMap(orderId => // Start polling when startPolling action is dispatched. Cancel old startPolling actions when new polling called.
        interval(3500).pipe(
          takeUntil(this.actions.pipe(ofType((MintActions.orderCompleted)))),  // Stop polling when stopPolling action is dispatched.
          exhaustMap(() =>  // Perform an HTTP request for each value emitted by the interval. Ignore new values until the HTTP request completes.
            this.ordinalsService.getOrderStatus(orderId).pipe(
              map(orderResponse => MintActions.updateOrderStatus({ orderResponse: orderResponse as InscriptionOrder })),
              catchError(() => EMPTY)
            )
          )
        )
      )
    )
  });

  // the order is completed when OrderBot startet the inscription
  // the property `sent` is the txid of the transaction that reveals the insription
  // eg. https://mempool.space/tx/f1997166547da9784a3e7419d2b248551565211811d4f5e705b685efa244451f
  detectOrderCompleted$ = createEffect(() =>
    this.actions.pipe(
      ofType(MintActions.updateOrderStatus),
      map(({ orderResponse }) => orderResponse.files[0]),
      filter(file => !!file.sent),
      map(() => MintActions.orderCompleted())
    )
  );

  // TODO
  /*
  loadMempoolInfo$ = createEffect(() =>
    this.actions.pipe(
      ofType(MintActions.updateOrderStatus),
      map(({ orderResponse }) => orderResponse.charge.chain_invoice.address),
      switchMap(address =>
        this.mempoolService.getUnconfirmedTransactions(address).pipe(
          map(transactions => MintActions.saveMempoolInfo({ transactions })),
          catchError(() => EMPTY)
        )
      )
    )
  );
  */

  loadAllInscriptionsOnRouting$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute(['']),
      concatMap(() => [
        MintActions.loadAllInscriptions(),
        MintActions.loadPrice({ code: '' })
      ]),
    );
  });

  loadAllInscriptions$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.loadAllInscriptions),
      switchMap(() =>
        this.ordinalsService.getCubes().pipe(
          retry({ count: 3, delay: 1000 }),
          concatMap(allInscriptions => [
            MintActions.loadAllInscriptionsSuccess({ allInscriptions: limitArray(allInscriptions, 12) }),
            PageActions.ready()
          ]),
          catchError(error => of(MintActions.loadAllInscriptionsFailure({ error }))))
      )
    );
  });


  // loadTokenMetadataOnRouting$ = createEffect(() => {
  //   return this.actions.pipe(
  //     ofRoute(['nft/:tokenId']),
  //     mapToParam('tokenId'),
  //     map(tokenId => MintActions.loadTokenMetadata({ tokenId: +tokenId })),
  //   );
  // });

  // loadTokenMetadata$ = createEffect(() => {
  //   return this.actions.pipe(
  //     ofType(MintActions.loadTokenMetadata),
  //     switchMap(() =>
  //       this.apiService.tokenMetadata().pipe(
  //         retry({ count: 3, delay: 1000 }),
  //         concatMap(tokenMetadataAndOwner => [
  //           MintActions.loadTokenMetadataSuccess(),
  //           PageActions.ready()
  //         ]),
  //         catchError(error => of(MintActions.loadTokenMetadataFailure({ error }))))
  //     )
  //   );
  // });

  showNotification$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.orderCompleted),
      tap(() => {

        this.notificationService.show({
          content: 'We received your payment and submitted a transaction that will inscribe your cube!',
          hideAfter: 10000,
          position: { horizontal: 'center', vertical: 'top' },
          animation: { type: 'slide', duration: 400 },
          type: { style: 'success', icon: true },
          // closable: true
        });

        this.ngZone.runOutsideAngular(() => confettiFirework());
      })
    )
  }, { dispatch: false });

  lookupInscriptionId$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.lookupInscriptionId),
      withLatestFrom(this.store.select(selectKnownInscriptionIds)),
      switchMap(([{ inscriptionNumber }, knownInscriptionIds]) => {
        const knownInscriptionId = knownInscriptionIds[inscriptionNumber];

        if (knownInscriptionId) {
          // If the inscriptionNumber is already known, directly emit lookupInscriptionIdSuccess
          return of(MintActions.lookupInscriptionIdSuccess({ inscriptionNumber, inscriptionId: knownInscriptionId }));
        } else {
          // Otherwise, make the service call
          return this.mintService.inscriptionNumberToId(inscriptionNumber).pipe(
            retry({ count: 3, delay: 1000 }),
            map(inscriptionId => MintActions.lookupInscriptionIdSuccess({ inscriptionNumber, inscriptionId })),
            catchError(error => of(MintActions.lookupInscriptionIdFailure({ error })))
          );
        }
      })
    );
  });

  loadPrice$ = createEffect(() =>
    this.actions.pipe(
      ofType(MintActions.loadPrice),
      switchMap(({ code }) =>
        defer(() => from(this.mintService.getFees())).pipe(
          retry({ count: 3, delay: 1000 }),
          switchMap(fees =>
            this.ordinalsService.getPrice(fees.halfHourFee, 557, code).pipe(
              retry({ count: 3, delay: 1000 }),
              map(price => MintActions.loadPriceSuccess({ price })),
              catchError(error => of(MintActions.loadPriceFailure({ error })))
            )
          )
        )
      )
    )
  );

}
