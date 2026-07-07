import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, props } from '@ngrx/store';

import {
  CubeSuggestion,
  InscriptionExtendedPaginatedResult,
  InscriptionExtendedSingleResult,
} from '../services/cubes-data/types';

/** The six inscriptions displayed on the six cube faces. */
export interface SixInscriptionIds {
  inscriptionId1: string;
  inscriptionId2: string;
  inscriptionId3: string;
  inscriptionId4: string;
  inscriptionId5: string;
  inscriptionId6: string;
}

/** Everything the mint form collects before it hands the HTML to the SDK. */
export interface CubeDetails {
  inscriptionIds: SixInscriptionIds,
  title: string,
  rotationSpeedX: string,
  rotationSpeedY: string,
  colorPane: string,
  bgColor1: string,
  bgColor2: string
}

/**
 * Read-side actions for the cube gallery + single-cube pages. All
 * write-side actions (OrdinalsBot orders, Xverse Sats-Connect
 * flow) were retired when cubes-frontend switched to ordpool-sdk's
 * `InscribeMintOrchestrator`; that orchestrator owns write state
 * directly via signals, so NgRx keeps only the read surface.
 */
export const MintActions = createActionGroup({
  source: 'Mint',
  events: {

    'Load Inscriptions': props<{ itemsPerPage: number, currentPage: number }>(),
    'Load Inscriptions Success':  props<{ inscriptions: InscriptionExtendedPaginatedResult }>(),
    'Load Inscriptions Failure': props<{ error: HttpErrorResponse }>(),

    'Load Single Inscription': props<{ inscriptionId: string }>(),
    'Load Single Inscription Success': props<{ singleInscription: InscriptionExtendedSingleResult }>(),
    'Load Single Inscription Failure': props<{ error: HttpErrorResponse }>(),

    'Lookup Inscription Id': props<{ inscriptionNumber: string }>(),
    'Lookup Inscription Id Success': props<{ inscriptionNumber: string, inscriptionId: string }>(),
    'Lookup Inscription Id Failure':  props<{ error: HttpErrorResponse }>(),

    'Load Cube Suggestion': props<{ collectionSymbol: string | '' }>(),
    'Load Cube Suggestion Success': props<{ cubeSuggestion: CubeSuggestion }>(),
    'Load Cube Suggestion Failure':  props<{ error: HttpErrorResponse }>(),

    // Fired by the mint page when InscribeMintOrchestrator's
    // successResult() flips — the past-slice reducer picks these up
    // for the "your recent mints" list on the start page.
    'Record Past Mint': props<{ commitTxId: string, revealTxId: string, createdAt: string }>(),
  }
});
