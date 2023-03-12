import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Metadata, MintTicket } from '../openapi-client';

export const MintActions = createActionGroup({
  source: 'Mint',
  events: {
    'Load All Mints': emptyProps(),
    'Load All Mints Success': props<{ allMints: Metadata[] }>(),
    'Load All Mints Failure': props<{ error: HttpErrorResponse }>(),

    'Load Token Info': props<{ tokenId: number }>(),
    'Load Token Info Success': props<{ tokenInfo: Metadata }>(),
    'Load Token Info Failure': props<{ error: HttpErrorResponse }>(),

    'Load Mint Allowlist': emptyProps,
    'Load Mint Allowlist Success': props<{ mintTicket: MintTicket }>(),
    'Load Mint Allowlist Failure': props<{ error: HttpErrorResponse }>(),
    'Clear Mint Allowlist': emptyProps,

    'Sign Message': emptyProps(),
    'Sign Message Success': emptyProps(),
    'Sign Message Failure': emptyProps()
  }
});
