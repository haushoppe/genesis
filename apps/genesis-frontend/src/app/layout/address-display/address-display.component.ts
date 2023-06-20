import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { PushModule } from '@rx-angular/template/push';

import { WalletFacade } from '../../store/wallet.facade';
import { BlockyIdenticonComponent } from './blocky/blocky-identicon.component';
import { ShortenAddressPipe } from './shorten-address.pipe';
import { ShortenNamePipe } from './shorten-name.pipe';

@Component({
  selector: 'app-address-display',
  templateUrl: './address-display.component.html',
  styleUrls: ['./address-display.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    ShortenNamePipe,
    ShortenAddressPipe,
    BlockyIdenticonComponent,
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
    return this.walletFacade.addressIsCurrentWallet(this.address)
  }
}
