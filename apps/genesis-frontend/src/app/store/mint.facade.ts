import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { MintActions } from './mint.actions';
import {
  selectAllMints,
  selectAllMintsStatus,
  selectMintAllowlistStatus,
  selectMintTicket,
  selectMintTicketStatus,
  selectTokenInfo,
  selectTokenInfoStatus,
} from './mint.reducer';
import { selectBestTotalSupply } from './mint.selectors';


@Injectable({
  providedIn: 'root'
})
export class MintFacade {

  store = inject(Store);

  allMints$ = this.store.select(selectAllMints);
  allMintsStatus$ = this.store.select(selectAllMintsStatus);

  tokenInfo$ = this.store.select(selectTokenInfo);
  tokenInfoStatus$ = this.store.select(selectTokenInfoStatus);

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
