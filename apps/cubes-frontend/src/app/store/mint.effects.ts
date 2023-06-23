import { inject, Injectable, NgZone } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { NotificationService } from '@progress/kendo-angular-notification';
import { EMPTY, from, interval, of } from 'rxjs';
import {
  catchError,
  concatMap,
  exhaustMap,
  filter,
  map,
  retry,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

import { OrdinalsService } from '../openapi-client';
import { OrderResponse } from '../ordinalsbot';
import { MintService } from '../services/mint-service';
import { confettiFirework } from './helper/confetti-firework';
import { MintActions } from './mint.actions';
import { selectOrderId, selectOrderResponse } from './mint.reducer';
import { PageActions } from './page.actions';
import { ofRoute } from './utils-ngrx-router/operators';
import { limitArray } from './helper/limit-array';
import { MempoolService } from '../services/mempool-service';


@Injectable()
export class MintEffects {

  actions = inject(Actions);
  ordinalsService = inject(OrdinalsService);
  mintService = inject(MintService);
  mempoolService = inject(MempoolService);
  store = inject(Store);
  notificationService = inject(NotificationService);
  ngZone = inject(NgZone);


  placeOrder$ = createEffect(() =>
    this.actions.pipe(
      ofType(MintActions.placeOrder),
      concatMap(({ receiveAddress, inscriptionIds }) =>
        from(this.mintService.getFees()).pipe(
          switchMap(fees =>
            this.mintService.placeOrder(receiveAddress, inscriptionIds, fees.halfHourFee).pipe(
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
      ofType(MintActions.placeOrderSuccess),
      exhaustMap(() =>  // Start polling when startPolling action is dispatched. Ignore new startPolling actions until the current polling completes.
        interval(2000).pipe(
          takeUntil(this.actions.pipe(ofType((MintActions.orderCompleted)))),  // Stop polling when stopPolling action is dispatched.

          withLatestFrom(
            this.store.select(selectOrderId),
            this.store.select(selectOrderResponse)
          ),
          map(([, orderId, orderResponse]) => ({
            orderId: orderId + '',
            orderResponse
          })),

          exhaustMap(({ orderId }) =>  // Perform an HTTP request for each value emitted by the interval. Ignore new values until the HTTP request completes.
            this.ordinalsService.getOrderStatus(orderId).pipe(
              map(orderResponse => MintActions.updateOrderStatus({ orderResponse: orderResponse as OrderResponse })),
              catchError(() => EMPTY)
            )
          )
        )
      )
    )
  });

  detectOrderCompleted$ = createEffect(() =>
    this.actions.pipe(
      ofType(MintActions.updateOrderStatus),
      map(({ orderResponse }) => orderResponse),
      filter(orderResponse => orderResponse.charge.status === 'paid'),
      map(() => MintActions.orderCompleted())
    )
  );

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




  loadAllInscriptionsOnRouting$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute(['']),
      map(() => MintActions.loadAllInscriptions()),
    );
  });

  loadAllInscriptions$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.loadAllInscriptions),
      switchMap(() =>
        this.ordinalsService.getCubes().pipe(
          retry({ count: 3, delay: 1000 }),
          concatMap(allInscriptions => [
            MintActions.loadAllInscriptionsSuccess({ allInscriptions: limitArray(allInscriptions, 20) }),
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
}
