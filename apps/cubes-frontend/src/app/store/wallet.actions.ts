import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const WalletActions = createActionGroup({
  source: 'Wallet',
  events: {

    'Connect Wallet': emptyProps(),
    'Connect Wallet Success': props<{ wallet: string }>(),
    'Connect Wallet Failure': emptyProps(),

    'Disconnect Wallet': emptyProps()
  }
});
