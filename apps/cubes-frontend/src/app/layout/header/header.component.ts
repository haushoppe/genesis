import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LetModule } from '@rx-angular/template/let';

import { SubmitStatus } from '../../store/submittable/submit-status';
import { WalletFacade } from '../../store/wallet.facade';
import { LoadingIndicatorButtonComponent } from '../loading-indicator-button/loading-indicator-button.component';
import { ShortenAddressPipe } from '../shorten-address.pipe';

@Component({
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    selector: 'header',
    imports: [
        NgIf,
        RouterLink,
        RouterLinkActive,
        LoadingIndicatorButtonComponent,
        LetModule,
        ShortenAddressPipe
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {

  walletFacade = inject(WalletFacade);

  SubmitStatus = SubmitStatus;
}
