import { Routes } from '@angular/router';

import { DetailsComponent } from './details/details.component';
import { FaqComponent } from './faq/faq.component';
import { PresskitComponent } from './presskit/presskit.component';
import { StartComponent } from './start/start.component';

/**
 * Routes for the cubes-frontend SPA. The /order/:orderId and
 * /order-connect/:txId routes were retired when cubes-frontend
 * switched to ordpool-sdk's `InscribeMintOrchestrator`: the mint
 * flow now stays on the same page and shows the commit + reveal
 * txids inline (mirroring ordpool's cat21-mint UX).
 */
export const ORDINAL_ROUTES: Routes = [
  { path: '', component: StartComponent },
  { path: 'mint/:collectionSymbol', component: StartComponent },
  { path: 'inscription/:inscriptionId', component: DetailsComponent, data: { hideBanner: true } },
  { path: 'faq', component: FaqComponent },
  { path: 'presskit', component: PresskitComponent },
  { path: '**', component: StartComponent },
];
