import { Routes } from '@angular/router';
// import { DetailsComponent } from './app/details/details.component';
import { StartComponent } from './start/start.component';
import { FaqComponent } from './faq/faq.component';
import { OrderDetailsComponent } from './order-details/order-details.component';

export const ORDINAL_ROUTES: Routes = [
  { path: '', component: StartComponent },
  // { path: 'nft/:tokenId', component: DetailsComponent }
  { path: 'faq', component: FaqComponent },
  { path: 'order/:orderId', component: OrderDetailsComponent, data: { hideBanner: true } }
];
