import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Metadata, MintTicket, TokenOwner } from '../openapi-client';

export const MintActions = createActionGroup({
  source: 'Mint',
  events: {

    // from Backend
    'Load All Token Metadata': emptyProps(),
    'Load All Token Metadata Success': props<{ allTokenMetadata: Metadata[] }>(),
    'Load All Token Metadata Failure': props<{ error: HttpErrorResponse }>(),

    // from Backend
    'Load Token Metadata': props<{ tokenId: number }>(),
    'Load Token Metadata Success': props<{ tokenMetadataAndOwner: { metadata: Metadata, owner: TokenOwner } }>(),
    'Load Token Metadata Failure': props<{ error: HttpErrorResponse }>(),

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
    'Load Total Supply': emptyProps(),
    'Load Total Supply Success': props<{ totalSupply: number }>(),
    'Load Total Supply Failure': props<{ error: Error }>(),

    // via Browsers' Provider
    'Mint Allowlist': props<{ mintNumber: number }>(),
    'Mint Allowlist Success': emptyProps(),
    'Mint Allowlist Failure': props<{ error: Error }>(),
  }
});
