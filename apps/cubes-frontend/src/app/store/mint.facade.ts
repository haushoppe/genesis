import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { MintActions } from './mint.actions';
import {
  selectAllTokenMetadata,
  selectAllTokenMetadataStatus,
  selectMintStatus,
  selectTokenMetadataAndOwner,
  selectTokenMetadataAndOwnerStatus,
  SixInscriptionIds,
} from './mint.reducer';


@Injectable({
  providedIn: 'root'
})
export class MintFacade {

  store = inject(Store);

  allTokenMetadata$ = this.store.select(selectAllTokenMetadata);
  allTokenMetadataStatus$ = this.store.select(selectAllTokenMetadataStatus);

  tokenMetadataAndOwner$ = this.store.select(selectTokenMetadataAndOwner);
  tokenMetadataAndOwnerStatus$ = this.store.select(selectTokenMetadataAndOwnerStatus);

  mintStatus$ = this.store.select(selectMintStatus);

  mint(inscriptionIds: SixInscriptionIds, receiveAddress: string) {
    this.store.dispatch(MintActions.mint({ inscriptionIds, receiveAddress }));
  }
}
