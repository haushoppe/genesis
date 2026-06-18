import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { defer, EMPTY, from, of, timer } from 'rxjs';
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
import { InscriptionOrder } from '../ordinalsbot';
import { MempoolService } from '../services/mempool.service';
import { MintService } from '../services/mint-service';
import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { CubeSuggestionService } from '../services/cubes-data/cube-suggestion.service';
import { confettiFirework } from './helper/confetti-firework';
import { MintActions } from './mint.actions';
import { selectInscriptions, selectKnownInscriptionIds } from './mint.reducer';
import { PageActions } from './page.actions';
import { mapToParam, ofRoute } from './utils-ngrx-router/operators';


@Injectable()
export class MintEffects {

  actions = inject(Actions);
  ordinalsService = inject(OrdinalsService);
  cubesData = inject(CubesDataService);
  cubeSuggestion = inject(CubeSuggestionService);
  mintService = inject(MintService);
  mempoolService = inject(MempoolService);
  store = inject(Store);
  ngZone = inject(NgZone);
  router = inject(Router);

  placeOrder$ = createEffect(() =>
    this.actions.pipe(
      ofType(MintActions.placeOrder),
      concatMap(({ cubeDetails, receiveAddress, code }) =>
        defer(() => from(this.mintService.getFees())).pipe(
          retry({ count: 3, delay: 1000 }),
          switchMap(fees =>
            this.mintService.placeOrder(cubeDetails, receiveAddress, code, fees.halfHourFee).pipe(
              tap(orderResponse => this.router.navigate(['/order', orderResponse.id])),
              map(orderResponse => MintActions.placeOrderSuccess({ orderResponse, createdAt: (new Date()).toISOString() })),
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
        timer(0, 3500).pipe(

          takeUntil(this.actions.pipe(ofType((MintActions.orderCompleted)))),  // Stop polling when stopPolling action is dispatched.
          takeUntil(this.actions.pipe(ofType((MintActions.orderNotFound)))),  // Stop polling

          exhaustMap(() =>  // Perform an HTTP request for each value emitted by the interval. Ignore new values until the HTTP request completes.
            this.ordinalsService.getOrderStatus(orderId).pipe(
              map(orderResponse => MintActions.updateOrderStatus({ orderResponse: orderResponse as InscriptionOrder })),
              catchError((error: HttpErrorResponse) => {
                if (error.status === 404) {
                  return of(MintActions.orderNotFound({ error }))
                }
                return EMPTY;
              })
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


  // -----


  createConnectInscription$ = createEffect(() =>
    this.actions.pipe(
      ofType(MintActions.createConnectInscription),
      concatMap(({ cubeDetails }) =>
        defer(() => from(this.mintService.getFees())).pipe(
          retry({ count: 3, delay: 1000 }),
          switchMap(fees =>
            this.mintService.createConnectInscription(cubeDetails, fees.halfHourFee).pipe(
              tap(inscriptionResponse => this.router.navigate(['/order-connect', inscriptionResponse.txId])),
              map(inscriptionResponse => MintActions.createConnectInscriptionSuccess({ inscriptionResponse, createdAt: (new Date()).toISOString() })),
              catchError(error => of(MintActions.createConnectInscriptionFailure({ error })))
            )
          )
        )
      )
    )
  );

  // immediately save the txId
  orderConnectDetailsPage$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute(['order-connect/:txId']),
      mapToParam('txId'),
      map(txId => MintActions.updateConnectInscriptionStatus({ inscriptionResponse: { txId } }))
    )
  });

  startConnectTransactionPolling$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute(['order-connect/:txId']),
      mapToParam('txId'),
      switchMap(txId => // Start polling when startPolling action is dispatched. Cancel old startPolling actions when new polling called.
        timer(0, 3500).pipe(

          takeUntil(this.actions.pipe(ofType((MintActions.connectInscriptionConfirmed)))),  // Stop polling when stopPolling action is dispatched.
          takeUntil(this.actions.pipe(ofType((MintActions.connectInscriptionNotFound)))),  // Stop polling

          exhaustMap(() =>  // Perform an HTTP request for each value emitted by the interval. Ignore new values until the HTTP request completes.
            this.mempoolService.getTransactionDetails(txId).pipe(
              retry({ // 3x retry in case the transaction was just not fetched by mempool.space
                count: 3,
                delay: 1000
              }),
              map(({ txid, vin, status }) => MintActions.updateConnectInscriptionStatus({ inscriptionResponse: {
                txId: txid,
                firstVin: vin[0],
                status
              }})),
              catchError((error: HttpErrorResponse) => {
                if (error.status === 404) {
                  return of(MintActions.connectInscriptionNotFound({ error: new Error('Transaction not found!') }))
                }
                return EMPTY;
              })
            )
          )
        )
      )
    )
  });

  detectConnectTransactionConfirmed$ = createEffect(() =>
    this.actions.pipe(
      ofType(MintActions.updateConnectInscriptionStatus),
      map(({ inscriptionResponse }) => inscriptionResponse.status),
      filter(status => !!status?.confirmed),
      map(() => MintActions.connectInscriptionConfirmed())
    )
  );


  // TODO
  /*
  getUnconfirmedTransactions$ = createEffect(() =>
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

  loadInitialDataOnRouting$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute([
        '',
        'mint/:collectionSymbol'
      ]),
      mapToParam('collectionSymbol'),
      withLatestFrom(this.store.select(selectInscriptions)),
      concatMap(([collectionSymbol, inscriptions]) => [
        ...(inscriptions?.inscriptions.length ? [] : [MintActions.loadInscriptions({
          itemsPerPage: 8,
          currentPage: 1
        })]),
        // MintActions.loadPrice({ code: '', size: 557 }), // lowest possible size
        MintActions.loadCubeSuggestion({ collectionSymbol: collectionSymbol || '' })
      ]),
    );
  });

  loadInscriptions$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.loadInscriptions),
      switchMap(({ itemsPerPage, currentPage }) =>
        this.cubesData.getInscriptions(itemsPerPage, currentPage).pipe(
          retry({ count: 3, delay: 1000 }),
          concatMap(inscriptions => [
            MintActions.loadInscriptionsSuccess({ inscriptions }),
            PageActions.ready()
          ]),
          catchError(error => of(MintActions.loadInscriptionsFailure({ error }))))
      )
    );
  });

  loadSingleInscriptionOnRouting$ = createEffect(() => {
    return this.actions.pipe(
      ofRoute(['inscription/:inscriptionId']),
      mapToParam('inscriptionId'),
      map(inscriptionId => MintActions.loadSingleInscription({ inscriptionId }))
    );
  });

  loadSingleInscription$ = createEffect(() => {
    return this.actions.pipe(
      ofType(MintActions.loadSingleInscription),
      switchMap(({ inscriptionId }) =>
        this.cubesData.getSingleInscription(inscriptionId).pipe(
          retry({ count: 3, delay: 1000 }),
          concatMap(singleInscription => [
            MintActions.loadSingleInscriptionSuccess({ singleInscription }),
            PageActions.ready()
          ]),
          catchError(error => of(MintActions.loadSingleInscriptionFailure({ error }))))
      )
    );
  });

  showConfettiFirework$ = createEffect(() => {
    return this.actions.pipe(
      ofType(
        MintActions.orderCompleted,
        MintActions.createConnectInscriptionSuccess),
      tap(() => {
        this.ngZone.runOutsideAngular(() => confettiFirework());
      })
    )
  }, { dispatch: false });

  // number to ID
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
      switchMap(({ code, size }) =>
        defer(() => from(this.mintService.getFees())).pipe(
          retry({ count: 3, delay: 1000 }),
          switchMap(fees =>
            this.ordinalsService.getPrice(
              fees.halfHourFee,
              size,
              code
            ).pipe(
              retry({ count: 3, delay: 1000 }),
              map(price => MintActions.loadPriceSuccess({ price })),
              catchError(error => of(MintActions.loadPriceFailure({ error })))
            )
          )
        )
      )
    )
  );

  loadCubeSuggestion$ = createEffect(() =>
    this.actions.pipe(
      ofType(MintActions.loadCubeSuggestion),
      switchMap(({ collectionSymbol }) =>
        this.cubeSuggestion.getCubeSuggestion(collectionSymbol).pipe(
          retry({ count: 5, delay: 1000 }),
          map(cubeSuggestion => MintActions.loadCubeSuggestionSuccess({ cubeSuggestion })),
          catchError(error => of(MintActions.loadCubeSuggestionFailure({ error })))
        )
      )
    )
  );

}
