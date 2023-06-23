import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { MintActions } from './mint.actions';
import {
  selectAllInscriptions,
  selectAllInscriptionsStatus,
  selectInscription,
  selectInscriptionStatus,
  selectOrderId,
  selectOrderResponse,
  selectOrderStatus,
  SixInscriptionIds,
} from './mint.reducer';


@Injectable({
  providedIn: 'root'
})
export class MintFacade {

  store = inject(Store);

  allInscriptions$ = this.store.select(selectAllInscriptions);
  allInscriptionsStatus$ = this.store.select(selectAllInscriptionsStatus);

  inscription$ = this.store.select(selectInscription);
  inscriptionStatus$ = this.store.select(selectInscriptionStatus);

  orderId$ = this.store.select(selectOrderId);
  orderResponse$ = this.store.select(selectOrderResponse);
  orderStatus$ = this.store.select(selectOrderStatus);

  mint(inscriptionIds: SixInscriptionIds, receiveAddress: string) {
    this.store.dispatch(MintActions.placeOrder({ inscriptionIds, receiveAddress }));
  }
}
