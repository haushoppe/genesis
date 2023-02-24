import { inject, Injectable } from "@angular/core";
import { Store } from '@ngrx/store';
import { selectMints, selectMintsStatus } from "./mint.reducer";
import { MintActions } from './mint.actions';


@Injectable({
  providedIn: 'root'
})
export class MintFacade {

  store = inject(Store);
  mints$ = this.store.select(selectMints);
  status$ = this.store.select(selectMintsStatus);

  loadMints() {
    this.store.dispatch(MintActions.loadMints());
  }

  connectWallet() {
    this.store.dispatch(MintActions.connectWallet());
  }
}
