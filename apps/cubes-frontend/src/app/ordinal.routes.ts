import { Routes } from '@angular/router';
// import { DetailsComponent } from './app/details/details.component';
import { StartComponent } from './start/start.component';
import { FaqComponent } from './faq/faq.component';
import { OrderDetailsComponent } from './order-details/order-details.component';
import { OrderConnectDetailsComponent } from './order-connect-details/order-connect-details.component';
import { PresskitComponent } from './presskit/presskit.component';

export const ORDINAL_ROUTES: Routes = [
  { path: '', component: StartComponent },
  { path: 'mint/:collectionSymbol', component: StartComponent },
  // { path: 'nft/:tokenId', component: DetailsComponent }
  { path: 'faq', component: FaqComponent },
  { path: 'presskit', component: PresskitComponent },
  { path: 'order/:orderId', component: OrderDetailsComponent, data: { hideBanner: true } },
  { path: 'order-connect/:txId', component: OrderConnectDetailsComponent, data: { hideBanner: true } },
  { path: '**', component: StartComponent },
];
