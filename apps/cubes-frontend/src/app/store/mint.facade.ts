import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { MintActions } from './mint.actions';
import {
  selectAllTokenMetadata,
  selectAllTokenMetadataStatus,
  selectMintOrderResponse,
  selectMintStatus,
  SixInscriptionIds,
} from './mint.reducer';


@Injectable({
  providedIn: 'root'
})
export class MintFacade {

  store = inject(Store);

  allTokenMetadata$ = this.store.select(selectAllTokenMetadata);
  allTokenMetadataStatus$ = this.store.select(selectAllTokenMetadataStatus);

  // tokenMetadataAndOwner$ = this.store.select(selectTokenMetadataAndOwner);
  // tokenMetadataAndOwnerStatus$ = this.store.select(selectTokenMetadataAndOwnerStatus);

  mintOrderResponse$ = this.store.select(selectMintOrderResponse);
  mintStatus$ = this.store.select(selectMintStatus);

  mint(inscriptionIds: SixInscriptionIds, receiveAddress: string) {
    this.store.dispatch(MintActions.mint({ inscriptionIds, receiveAddress }));
  }
}
