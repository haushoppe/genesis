import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { SixInscriptionIds } from './mint.reducer';

export const MintActions = createActionGroup({
  source: 'Mint',
  events: {

    'Load All Token Metadata': emptyProps(),
    'Load All Token Metadata Success': emptyProps(),
    'Load All Token Metadata Failure': props<{ error: HttpErrorResponse }>(),

    // 'Load Token Metadata': props<{ tokenId: number }>(),
    // 'Load Token Metadata Success': emptyProps(),
    // 'Load Token Metadata Failure': props<{ error: HttpErrorResponse }>(),

    'Mint': props<{ inscriptionIds: SixInscriptionIds, receiveAddress: string}>(),
    'Mint Success': props<{ invoice: string }>(),
    'Mint Failure': props<{ error: HttpErrorResponse }>(),
  }
});
