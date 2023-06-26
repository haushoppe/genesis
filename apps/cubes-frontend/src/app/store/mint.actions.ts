import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { Inscription, InscriptionOrder } from '../ordinalsbot';
import { SixInscriptionIds } from './mint.reducer';
import { InscriptionSimple } from '../openapi-client';
import { MempoolTransaction } from '../services/mempool-service';

export const MintActions = createActionGroup({
  source: 'Mint',
  events: {

    'Load All Inscriptions': emptyProps(),
    'Load All Inscriptions Success':  props<{ allInscriptions: InscriptionSimple[] }>(),
    'Load All Inscriptions Failure': props<{ error: HttpErrorResponse }>(),

    'Load Inscription': props<{ inscriptionId: string }>(),
    'Load Inscription Success': props<{ inscription: Inscription }>(),
    'Load Inscription Failure': props<{ error: HttpErrorResponse }>(),

    'Place Order': props<{ receiveAddress: string, inscriptionIds: SixInscriptionIds, code: string }>(),
    'Place Order Success': props<{ orderResponse: InscriptionOrder }>(),
    'Place Order Failure': props<{ error: HttpErrorResponse }>(),
    'Update Order Status': props<{ orderResponse: InscriptionOrder }>(),
    'Order Completed': emptyProps(),

    'Save Mempool Info': props<{ transactions: MempoolTransaction[] }>(),

    'Lookup Inscription Id': props<{ inscriptionNumber: string }>(),
    'Lookup Inscription Id Success': props<{ inscriptionNumber: string, inscriptionId: string }>(),
    'Lookup Inscription Id Failure':  props<{ error: HttpErrorResponse }>()
  }
});
