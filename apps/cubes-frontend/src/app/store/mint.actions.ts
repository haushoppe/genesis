import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { Inscription, InscriptionOrder } from '../ordinalsbot';
import { InscriptionSimple, Price } from '../openapi-client';
import { MempoolTransaction } from '../services/mempool-service';

export interface SixInscriptionIds {
  inscriptionId1: string;
  inscriptionId2: string;
  inscriptionId3: string;
  inscriptionId4: string;
  inscriptionId5: string;
  inscriptionId6: string;
}

export interface CubeDetails {
  inscriptionIds: SixInscriptionIds,
  title: string,
  rotationSpeedX: string,
  rotationSpeedY: string,
  colorPane: string,
  bgColor1: string,
  bgColor2: string
}

export const MintActions = createActionGroup({
  source: 'Mint',
  events: {

    'Load All Inscriptions': emptyProps(),
    'Load All Inscriptions Success':  props<{ allInscriptions: InscriptionSimple[] }>(),
    'Load All Inscriptions Failure': props<{ error: HttpErrorResponse }>(),

    'Load Inscription': props<{ inscriptionId: string }>(),
    'Load Inscription Success': props<{ inscription: Inscription }>(),
    'Load Inscription Failure': props<{ error: HttpErrorResponse }>(),

    'Place Order': props<{ cubeDetails: CubeDetails, receiveAddress: string, code: string }>(),
    'Place Order Success': props<{ orderResponse: InscriptionOrder }>(),
    'Place Order Failure': props<{ error: HttpErrorResponse }>(),
    'Update Order Status': props<{ orderResponse: InscriptionOrder }>(),
    'Order Not Found': props<{ error: HttpErrorResponse }>(),
    'Order Completed': emptyProps(),

    'Save Mempool Info': props<{ transactions: MempoolTransaction[] }>(),

    'Lookup Inscription Id': props<{ inscriptionNumber: string }>(),
    'Lookup Inscription Id Success': props<{ inscriptionNumber: string, inscriptionId: string }>(),
    'Lookup Inscription Id Failure':  props<{ error: HttpErrorResponse }>(),

    'Load Price': props<{ code: string, size: number }>(),
    'Load Price Success': props<{ price: Price }>(),
    'Load Price Failure':  props<{ error: HttpErrorResponse }>()
  }
});
