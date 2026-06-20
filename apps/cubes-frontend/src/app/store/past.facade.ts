import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { selectPastCreatedInscriptions, selectPastOrders } from './past.reducer';


@Injectable({
  providedIn: 'root'
})
export class PastFacade {

  store = inject(Store);

  pastOrders = this.store.selectSignal(selectPastOrders);
  pastCreatedInscriptions = this.store.selectSignal(selectPastCreatedInscriptions);

  // Legacy Observable variants — removed once template consumers migrate.
  pastOrders$ = this.store.select(selectPastOrders);
  pastCreatedInscriptions$ = this.store.select(selectPastCreatedInscriptions);
}
