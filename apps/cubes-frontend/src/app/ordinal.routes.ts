import { Routes } from '@angular/router';
// import { DetailsComponent } from './app/details/details.component';
import { StartComponent } from './start/start.component';
import { FaqComponent } from './faq/faq.component';
import { OrderDetailsComponent } from './order-details/order-details.component';
import { OrderConnectDetailsComponent } from './order-connect-details/order-connect-details.component';
import { PresskitComponent } from './presskit/presskit.component';
import { DetailsComponent } from './details/details.component';

export const ORDINAL_ROUTES: Routes = [
  { path: '', component: StartComponent },
  { path: 'mint/:collectionSymbol', component: StartComponent },
  { path: 'inscription/:inscriptionId', component: DetailsComponent, data: { hideBanner: true } },
  { path: 'faq', component: FaqComponent },
  { path: 'presskit', component: PresskitComponent },
  { path: 'order/:orderId', component: OrderDetailsComponent, data: { hideBanner: true } },
  { path: 'order-connect/:txId', component: OrderConnectDetailsComponent, data: { hideBanner: true } },
  { path: '**', component: StartComponent },
];
