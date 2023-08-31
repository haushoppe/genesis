import { JsonPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LetModule } from '@rx-angular/template/let';

import { SubmitStatus } from '../../store/submittable/submit-status';
import { WalletFacade } from '../../store/wallet.facade';
import { LoadingIndicatorButtonComponent } from '../loading-indicator-button/loading-indicator-button.component';
import { WalletService } from '../../services/wallet-service';

@Component({
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  selector: 'header',
  standalone: true,
  imports: [
    NgIf,
    RouterLink,
    RouterLinkActive,
    LoadingIndicatorButtonComponent,
    LetModule,
    JsonPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {

  walletFacade = inject(WalletFacade);
  walletService = inject(WalletService);
  SubmitStatus = SubmitStatus;
  window = window;

  constructor(cd: ChangeDetectorRef) {
    // window.BitcoinProvider is null in the beginning??
    window.setTimeout(() => cd.detectChanges(), 500);
    window.setTimeout(() => cd.detectChanges(), 1000);
    window.setTimeout(() => cd.detectChanges(), 1500);

  }
}
