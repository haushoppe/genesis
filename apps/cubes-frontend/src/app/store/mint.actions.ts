import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Metadata, TokenOwner } from '../openapi-client';
import { SixInscriptionIds } from './mint.reducer';

export const MintActions = createActionGroup({
  source: 'Mint',
  events: {

    'Load All Token Metadata': emptyProps(),
    'Load All Token Metadata Success': props<{ allTokenMetadata: Metadata[] }>(),
    'Load All Token Metadata Failure': props<{ error: HttpErrorResponse }>(),

    'Load Token Metadata': props<{ tokenId: number }>(),
    'Load Token Metadata Success': props<{ tokenMetadataAndOwner: { metadata: Metadata, owner: TokenOwner } }>(),
    'Load Token Metadata Failure': props<{ error: HttpErrorResponse }>(),

    // Inscription IDs are of the form TXIDiN, where TXID is the transaction ID of the reveal transaction,
    // and N is the index of the inscription in the reveal transaction.
    'Mint': props<{ inscriptionIds: SixInscriptionIds, receiveAddress: string}>(),
    'Mint Success': props<{ invoice: string }>(),
    'Mint Failure': props<{ error: HttpErrorResponse }>(),
  }
});
