import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { MintActions } from './mint.actions';
import { selectPastMints } from './past.reducer';


@Injectable({
  providedIn: 'root'
})
export class PastFacade {

  store = inject(Store);

  pastMints = this.store.selectSignal(selectPastMints);

  recordPastMint(commitTxId: string, revealTxId: string): void {
    this.store.dispatch(MintActions.recordPastMint({
      commitTxId,
      revealTxId,
      createdAt: new Date().toISOString(),
    }));
  }
}
