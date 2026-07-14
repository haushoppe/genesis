import { Routes } from '@angular/router';

import { DetailsComponent } from './details/details.component';
import { FaqComponent } from './faq/faq.component';
import { PresskitComponent } from './presskit/presskit.component';
import { StartComponent } from './start/start.component';

export const ORDINAL_ROUTES: Routes = [
  { path: '',                           component: StartComponent,    title: 'Ordinal Cubes — mint your cube' },
  { path: 'mint/:collectionSymbol',     component: StartComponent,    title: 'Ordinal Cubes — mint your cube' },
  { path: 'inscription/:inscriptionId', component: DetailsComponent,  title: 'Ordinal Cubes — cube details', data: { hideBanner: true } },
  { path: 'faq',                        component: FaqComponent,      title: 'Ordinal Cubes — FAQ' },
  { path: 'presskit',                   component: PresskitComponent, title: 'Ordinal Cubes — presskit' },
  { path: '**',                         component: StartComponent,    title: 'Ordinal Cubes' },
];
