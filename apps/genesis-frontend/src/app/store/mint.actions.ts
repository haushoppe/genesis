import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Metadata } from '../openapi-client';

export const MintActions = createActionGroup({
  source: 'Mint',
  events: {
    'Load Mints': emptyProps(),
    'Load Mints Success': props<{ mints: Metadata[] }>(),
    'Load Mints Failure': props<{ error: HttpErrorResponse }>(),
    'Connect Wallet': emptyProps(),
  }
});
