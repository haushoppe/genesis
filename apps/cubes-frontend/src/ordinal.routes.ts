import { Routes } from '@angular/router';
// import { DetailsComponent } from './app/details/details.component';
import { StartComponent } from './app/start/start.component';
import { FaqComponent } from './app/faq/faq.component';
import { OrderDisplayComponent } from './app/order-display/order-display.component';

export const ORDINAL_ROUTES: Routes = [
  { path: '', component: StartComponent },
  // { path: 'nft/:tokenId', component: DetailsComponent }
  { path: 'faq', component: FaqComponent },
  { path: 'order/:orderId', component: OrderDisplayComponent }

];
