import { Routes } from '@angular/router';
// import { DetailsComponent } from './app/details/details.component';
import { StartComponent } from './app/start/start.component';
import { FaqComponent } from './app/faq/faq.component';
import { OrderDetailsComponent } from './app/order-details/order-details.component';

export const ORDINAL_ROUTES: Routes = [
  { path: '', component: StartComponent },
  // { path: 'nft/:tokenId', component: DetailsComponent }
  { path: 'faq', component: FaqComponent },
  { path: 'order/:orderId', component: OrderDetailsComponent, data: { hideBanner: true } }
];
