import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { MintActions } from './mint.actions';
import {
  selectAllInscriptions,
  selectAllInscriptionsStatus,
  selectInscription,
  selectInscriptionStatus,
  selectKnownInscriptionIdStatus,
  selectOrderResponse,
  selectOrderStatus,
  selectPrice,
  selectPriceStatus,
  SixInscriptionIds,
} from './mint.reducer';
import { selectBestOrderId, selectFile, selectInscriptionId, selectIsPaymentPending } from './mint.selectors';


@Injectable({
  providedIn: 'root'
})
export class MintFacade {

  store = inject(Store);

  allInscriptions$ = this.store.select(selectAllInscriptions);
  allInscriptionsStatus$ = this.store.select(selectAllInscriptionsStatus);

  inscription$ = this.store.select(selectInscription);
  inscriptionStatus$ = this.store.select(selectInscriptionStatus);

  orderResponse$ = this.store.select(selectOrderResponse);
  orderStatus$ = this.store.select(selectOrderStatus);

  file$ = this.store.select(selectFile);
  isPaymentPending$ = this.store.select(selectIsPaymentPending);
  bestOrderId$ = this.store.select(selectBestOrderId);

  knownInscriptionIdStatus$ = this.store.select(selectKnownInscriptionIdStatus);

  price$ = this.store.select(selectPrice);
  priceStatus$ = this.store.select(selectPriceStatus);


  mint(inscriptionIds: SixInscriptionIds, receiveAddress: string, code: string) {
    this.store.dispatch(MintActions.placeOrder({ inscriptionIds, receiveAddress, code }));
  }

  lookupInscriptionId(inscriptionNumber: string) {
    this.store.dispatch(MintActions.lookupInscriptionId({ inscriptionNumber }));
    return this.store.select(selectInscriptionId(inscriptionNumber));
  }
}
