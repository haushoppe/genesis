import { Routes } from '@angular/router';
// import { DetailsComponent } from './app/details/details.component';
import { StartComponent } from './app/start/start.component';
import { FaqComponent } from './app/faq/faq.component';

export const NFT_ROUTES: Routes = [
  { path: '', component: StartComponent },
  // { path: 'nft/:tokenId', component: DetailsComponent }
  { path: 'faq', component: FaqComponent }
];
