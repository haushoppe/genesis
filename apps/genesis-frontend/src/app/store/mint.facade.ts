import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { MintActions } from './mint.actions';
import {
  selectAllMints,
  selectAllMintsStatus,
  selectMintTicket,
  selectMintTicketStatus,
  selectTokenInfo,
  selectTokenInfoStatus,
} from './mint.reducer';


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

  signMessage() {
    this.store.dispatch(MintActions.signMessage());
  }
}
