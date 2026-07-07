import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { getCubeHtml } from '../services/cube-html';
import { CubeDetails, MintActions } from './mint.actions';
import {
  selectInscriptions,
  selectInscriptionsStatus,
  selectCubeSuggestion,
  selectCubeSuggestionStatus,
  selectSingleInscription,
  selectSingleInscriptionStatus,
  selectKnownInscriptionIdStatus,
} from './mint.reducer';
import {
  selectCubeSuggestionFixed,
  selectInscriptionId,
} from './mint.selectors';


/**
 * Read-side facade for the cube gallery + single-cube pages. All
 * write-side facade methods (placeOrder, createConnectInscription,
 * loadPrice) were retired when cubes-frontend switched to
 * ordpool-sdk's `InscribeMintOrchestrator`; the orchestrator owns
 * mint state directly via signals, so consumers call it, not the
 * facade.
 */
@Injectable({
  providedIn: 'root'
})
export class MintFacade {

  store = inject(Store);

  inscriptions = this.store.selectSignal(selectInscriptions);
  inscriptionsStatus = this.store.selectSignal(selectInscriptionsStatus);
  singleInscription = this.store.selectSignal(selectSingleInscription);
  singleInscriptionStatus = this.store.selectSignal(selectSingleInscriptionStatus);
  knownInscriptionIdStatus = this.store.selectSignal(selectKnownInscriptionIdStatus);
  cubeSuggestion = this.store.selectSignal(selectCubeSuggestion);
  cubeSuggestionStatus = this.store.selectSignal(selectCubeSuggestionStatus);
  cubeSuggestionFixed = this.store.selectSignal(selectCubeSuggestionFixed);


  lookupInscriptionId(inscriptionNumber: string) {
    this.store.dispatch(MintActions.lookupInscriptionId({ inscriptionNumber }));
    return this.store.select(selectInscriptionId(inscriptionNumber));
  }

  loadCubeSuggestion(collectionSymbol = '') {
    this.store.dispatch(MintActions.loadCubeSuggestion({ collectionSymbol }));
  }

  /**
   * Build the cube HTML from the form fields. Pure — no HTTP calls,
   * no state mutation. Consumers pass the return value to
   * `InscribeMintOrchestrator.setContent({body: encoded(html), ...})`.
   */
  getCubeHtml(cubeDetails: CubeDetails): string {
    return getCubeHtml(cubeDetails);
  }

  loadInscriptions(itemsPerPage: number, currentPage: number) {
    if (itemsPerPage) {
      this.store.dispatch(MintActions.loadInscriptions({ itemsPerPage, currentPage }));
    }
  }
}
