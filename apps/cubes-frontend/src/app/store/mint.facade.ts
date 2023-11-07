import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { MintService } from '../services/mint-service';
import { CubeDetails, MintActions } from './mint.actions';
import {
  selectInscriptions,
  selectInscriptionsStatus,
  selectCreateInscriptionResponse,
  selectCreateInscriptionStatus,
  selectCubeSuggestion,
  selectCubeSuggestionStatus,
  selectSingleInscription,
  selectSingleInscriptionStatus,
  selectKnownInscriptionIdStatus,
  selectOrderResponse,
  selectOrderStatus,
  selectPrice,
  selectPriceStatus,
} from './mint.reducer';
import {
  selectBestTransactionId,
  selectBestOrderId,
  selectCubeSuggestionFixed,
  selectFile,
  selectInscriptionId,
  selectIsOrderPending,
} from './mint.selectors';


@Injectable({
  providedIn: 'root'
})
export class MintFacade {

  store = inject(Store);
  mintService = inject(MintService);

  inscriptions$ = this.store.select(selectInscriptions);
  inscriptionsStatus$ = this.store.select(selectInscriptionsStatus);

  singleInscription$ = this.store.select(selectSingleInscription);
  singleInscriptionStatus$ = this.store.select(selectSingleInscriptionStatus);

  orderResponse$ = this.store.select(selectOrderResponse);
  orderStatus$ = this.store.select(selectOrderStatus);

  createInscriptionResponse$ = this.store.select(selectCreateInscriptionResponse);
  createInscriptionStatus$ = this.store.select(selectCreateInscriptionStatus);


  file$ = this.store.select(selectFile);
  isOrderPending$ = this.store.select(selectIsOrderPending);
  bestOrderId$ = this.store.select(selectBestOrderId);
  bestTransactionId$ = this.store.select(selectBestTransactionId);


  knownInscriptionIdStatus$ = this.store.select(selectKnownInscriptionIdStatus);

  price$ = this.store.select(selectPrice);
  priceStatus$ = this.store.select(selectPriceStatus);

  cubeSuggestion$ = this.store.select(selectCubeSuggestion);
  cubeSuggestionStatus$ = this.store.select(selectCubeSuggestionStatus);
  cubeSuggestionFixed$ = this.store.select(selectCubeSuggestionFixed);


  placeOrder(cubeDetails: CubeDetails, receiveAddress: string, code: string) {
    this.store.dispatch(MintActions.placeOrder({
      cubeDetails,
      receiveAddress,
      code
    }));
  }

  createConnectInscription(cubeDetails: CubeDetails) {
    this.store.dispatch(MintActions.createConnectInscription({
      cubeDetails
    }));
  }

  lookupInscriptionId(inscriptionNumber: string) {
    this.store.dispatch(MintActions.lookupInscriptionId({ inscriptionNumber }));
    return this.store.select(selectInscriptionId(inscriptionNumber));
  }

  loadPrice(size: number, code = '') {
    this.store.dispatch(MintActions.loadPrice({ code, size }));
  }

  loadCubeSuggestion(collectionSymbol = '') {
    this.store.dispatch(MintActions.loadCubeSuggestion({ collectionSymbol }));
  }

  getCubeHtml(cubeDetails: CubeDetails) {
    return this.mintService.getCubeHtml(cubeDetails);
  }

  loadInscriptions(itemsPerPage: number, currentPage: number) {
    if (itemsPerPage) {
      this.store.dispatch(MintActions.loadInscriptions({ itemsPerPage, currentPage }));
    }
  }
}
