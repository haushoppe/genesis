import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { PushModule } from '@rx-angular/template/push';

import { WalletFacade } from '../../store/wallet.facade';
import { ShortenAddressPipe } from './shorten-address.pipe';
import { ShortenNamePipe } from './shorten-name.pipe';

@Component({
  selector: 'app-cube-preview',
  templateUrl: './cube-preview.component.html',
  styleUrls: ['./cube-preview.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    ShortenNamePipe,
    ShortenAddressPipe,
    PushModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddressDisplayComponent {

  @Input() name?: string;
  @Input() address?: string;
  @Input() showAddressIsCurrentWallet = true;

  walletFacade = inject(WalletFacade);

  get isCurrentWallet$() {
    return false;
  }
}
