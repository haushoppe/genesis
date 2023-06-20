import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { MintActions } from './mint.actions';
import {
  selectAllTokenMetadata,
  selectAllTokenMetadataOfWallet,
  selectAllTokenMetadataOfWalletStatus,
  selectAllTokenMetadataStatus,
  selectMintAllowlistStatus,
  selectMintTicket,
  selectMintTicketStatus,
  selectTokenMetadataAndOwner,
  selectTokenMetadataAndOwnerStatus,
} from './mint.reducer';
import { selectBestTotalSupply } from './mint.selectors';


@Injectable({
  providedIn: 'root'
})
export class MintFacade {

  store = inject(Store);

  allTokenMetadata$ = this.store.select(selectAllTokenMetadata);
  allTokenMetadataStatus$ = this.store.select(selectAllTokenMetadataStatus);

  allTokenMetadataOfWallet$ = this.store.select(selectAllTokenMetadataOfWallet);
  allTokenMetadataOfWalletStatus$ = this.store.select(selectAllTokenMetadataOfWalletStatus);

  tokenMetadataAndOwner$ = this.store.select(selectTokenMetadataAndOwner);
  tokenMetadataAndOwnerStatus$ = this.store.select(selectTokenMetadataAndOwnerStatus);

  mintTicket$ = this.store.select(selectMintTicket);
  mintTicketStatus$ = this.store.select(selectMintTicketStatus);

  bestTotalSupply$ = this.store.select(selectBestTotalSupply);

  mintAllowlistStatus$ = this.store.select(selectMintAllowlistStatus);


  signMessage() {
    this.store.dispatch(MintActions.signMessage());
  }

  mintAllowlist(mintNumber: number) {
    this.store.dispatch(MintActions.mintAllowlist({ mintNumber }));
  }
}
