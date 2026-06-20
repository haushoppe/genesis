import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ForModule } from '@rx-angular/template/for';
import { LetModule } from '@rx-angular/template/let';
import { PushModule } from '@rx-angular/template/push';

import { AlertComponent } from '../layout/alert/alert.component';
import { InscriptionListItemComponent } from '../layout/inscription-list-item/inscription-list-item.component';
import { LoadingIndicatorButtonComponent } from '../layout/loading-indicator-button/loading-indicator-button.component';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { MintFacade } from '../store/mint.facade';
import { SubmitStatus } from '../store/submittable/submit-status';
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
        LoadingIndicatorButtonComponent,
        AlertComponent,
        InscriptionListItemComponent,
        NgFor,
        NgIf,
        LetModule,
        ForModule,
        PushModule,
        MintFormComponent,
        RouterLink,
        PastOrdersAndInscriptionsComponent,
        NgbPagination
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StartComponent {
  mintFacade = inject(MintFacade);
  walletFacade = inject(WalletFacade);

  SubmitStatus = SubmitStatus;
}
