import { AsyncPipe, JsonPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LoadingIndicatorButtonComponent } from '../layout/loading-indicator-button/loading-indicator-button.component';

import { AlertComponent } from '../layout/loading-indicator/alert/alert.component';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { NftDisplayListComponent } from '../layout/nft-display-list/nft-display-list.component';
import { MintFacade } from '../store/mint.facade';
import { WalletFacade } from '../store/wallet.facade';

@Component({
    selector: 'app-start',
    templateUrl: './start.component.html',
    styleUrls: ['./start.component.scss'],
    standalone: true,
    imports: [
      AsyncPipe,
      JsonPipe,
      LoadingIndicatorComponent,
      LoadingIndicatorButtonComponent,
      AlertComponent,
      NftDisplayListComponent,
      NgFor,
      NgIf
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StartComponent {
  mintFacade = inject(MintFacade);
  walletFacade = inject(WalletFacade);
}
