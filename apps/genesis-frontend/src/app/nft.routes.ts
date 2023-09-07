import { Routes } from '@angular/router';
import { DetailsComponent } from './details/details.component';
import { StartComponent } from './start/start.component';

export const NFT_ROUTES: Routes = [
  { path: '', component: StartComponent },
  { path: 'nft/:tokenId', component: DetailsComponent }
];
