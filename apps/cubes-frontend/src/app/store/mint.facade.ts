import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { MintActions } from './mint.actions';
import {
  selectAllInscriptions,
  selectAllInscriptionsStatus,
  selectInscription,
  selectInscriptionStatus,
  selectOrderResponse,
  selectOrderStatus,
  SixInscriptionIds,
} from './mint.reducer';
import { selectBestOrderId, selectFile, selectIsPaymentPending } from './mint.selectors';


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

  mint(inscriptionIds: SixInscriptionIds, receiveAddress: string, code: string) {
    this.store.dispatch(MintActions.placeOrder({ inscriptionIds, receiveAddress, code }));
  }
}
