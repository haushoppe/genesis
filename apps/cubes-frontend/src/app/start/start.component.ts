import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InscriptionListItemComponent } from '../layout/inscription-list-item/inscription-list-item.component';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { MintFacade } from '../store/mint.facade';
import { WalletFacade } from '../store/wallet.facade';
import { MintFormComponent } from './mint-form/mint-form.component';
import { PastOrdersAndInscriptionsComponent } from './past-orders-and-inscriptions/past-orders-and-inscriptions.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
  imports: [
    LoadingIndicatorComponent,
    InscriptionListItemComponent,
    MintFormComponent,
    PastOrdersAndInscriptionsComponent,
    NgbPagination,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartComponent {
  mintFacade = inject(MintFacade);
  walletFacade = inject(WalletFacade);
}
