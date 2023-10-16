import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { CubeSuggestion, InscriptionSimple, Price } from '../openapi-client';
import { OrdinalsbotInscription, InscriptionOrder } from '../ordinalsbot';
import { TransactionStatus, VinEntry } from '../services/mempool.service.transaction-details.types';

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
    'Load Inscription Success': props<{ inscription: OrdinalsbotInscription }>(),
    'Load Inscription Failure': props<{ error: HttpErrorResponse }>(),

    'Place Order': props<{ cubeDetails: CubeDetails, receiveAddress: string, code: string | ''}>(),
    'Place Order Success': props<{ orderResponse: InscriptionOrder, createdAt: string }>(),
    'Place Order Failure': props<{ error: HttpErrorResponse }>(),
    'Update Order Status': props<{ orderResponse: InscriptionOrder }>(),
    'Order Not Found': props<{ error: HttpErrorResponse }>(),
    'Order Completed': emptyProps(),

    'Create Connect Inscription': props<{ cubeDetails: CubeDetails }>(),
    'Create Connect Inscription Success': props<{ inscriptionResponse: { txId: string }, createdAt: string }>(),
    'Create Connect Inscription Failure': props<{ error: Error }>(),
    'Update Connect Inscription Status': props<{ inscriptionResponse: {
      txId: string,
      firstVin?: VinEntry,
      status?: TransactionStatus
    }}>(),
    'Connect Inscription Not Found': props<{ error: Error }>(),
    'Connect Inscription Confirmed': emptyProps(),


    'Lookup Inscription Id': props<{ inscriptionNumber: string }>(),
    'Lookup Inscription Id Success': props<{ inscriptionNumber: string, inscriptionId: string }>(),
    'Lookup Inscription Id Failure':  props<{ error: HttpErrorResponse }>(),

    'Load Price': props<{ code: string | '', size: number }>(),
    'Load Price Success': props<{ price: Price }>(),
    'Load Price Failure':  props<{ error: HttpErrorResponse }>(),

    'Load Cube Suggestion': props<{ collectionSymbol: string | '' }>(),
    'Load Cube Suggestion Success': props<{ cubeSuggestion: CubeSuggestion }>(),
    'Load Cube Suggestion Failure':  props<{ error: HttpErrorResponse }>(),


     // 'Save Mempool Info': props<{ transactions: MempoolTransaction[] }>(),
  }
});
