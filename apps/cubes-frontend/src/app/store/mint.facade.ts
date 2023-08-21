import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { CubeDetails, MintActions } from './mint.actions';
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
} from './mint.reducer';
import { selectBestOrderId, selectFile, selectInscriptionId, selectIsOrderPending } from './mint.selectors';


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
  isOrderPending$ = this.store.select(selectIsOrderPending);
  bestOrderId$ = this.store.select(selectBestOrderId);

  knownInscriptionIdStatus$ = this.store.select(selectKnownInscriptionIdStatus);

  price$ = this.store.select(selectPrice);
  priceStatus$ = this.store.select(selectPriceStatus);


  mint(cubeDetails: CubeDetails, receiveAddress: string, code: string) {
    this.store.dispatch(MintActions.placeOrder({
      cubeDetails,
      receiveAddress,
      code
    }));
  }

  lookupInscriptionId(inscriptionNumber: string) {
    this.store.dispatch(MintActions.lookupInscriptionId({ inscriptionNumber }));
    return this.store.select(selectInscriptionId(inscriptionNumber));
  }

  loadPrice(code = '') {
    this.store.dispatch(MintActions.loadPrice({ code }));
  }
}
