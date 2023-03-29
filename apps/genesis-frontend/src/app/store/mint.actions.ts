import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Metadata, MintTicket } from '../openapi-client';

export const MintActions = createActionGroup({
  source: 'Mint',
  events: {

    // from Backend
    'Load All Mints': emptyProps(),
    'Load All Mints Success': props<{ allMints: Metadata[] }>(),
    'Load All Mints Failure': props<{ error: HttpErrorResponse }>(),

    // from Backend
    'Load Token Info': props<{ tokenId: number }>(),
    'Load Token Info Success': props<{ tokenInfo: Metadata }>(),
    'Load Token Info Failure': props<{ error: HttpErrorResponse }>(),

    // from Backend
    'Load Mint Ticket': emptyProps,
    'Load Mint Ticket Success': props<{ mintTicket: MintTicket }>(),
    'Load Mint Ticket Failure': props<{ error: HttpErrorResponse }>(),
    'Clear Mint Ticket': emptyProps,

    // via Provider
    'Sign Message': emptyProps(),
    'Sign Message Success': emptyProps(),
    'Sign Message Failure': emptyProps(),

    // via Browsers' Provider
    'Get Total Supply': emptyProps(),
    'Get Total Supply Message Success': emptyProps(),
    'Get Total Supply Message Failure': emptyProps()
  }
});
