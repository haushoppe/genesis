import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { Inscription, OrderResponse } from '../ordinalsbot';
import { SixInscriptionIds } from './mint.reducer';
import { InscriptionSimple } from '../openapi-client';

export const MintActions = createActionGroup({
  source: 'Mint',
  events: {

    'Load All Inscriptions': emptyProps(),
    'Load All Inscriptions Success':  props<{ allInscriptions: InscriptionSimple[] }>(),
    'Load All Inscriptions Failure': props<{ error: HttpErrorResponse }>(),

    'Load Inscription': props<{ inscriptionId: string }>(),
    'Load Inscription Success': props<{ inscription: Inscription }>(),
    'Load Inscription Failure': props<{ error: HttpErrorResponse }>(),

    'Place Order': props<{ receiveAddress: string, inscriptionIds: SixInscriptionIds }>(),
    'Place Order Success': props<{ orderResponse: OrderResponse }>(),
    'Place Order Failure': props<{ error: HttpErrorResponse }>(),
    'Update Order Status': props<{ orderResponse: OrderResponse }>(),
    'Order Completed': emptyProps()
  }
});
