import { JsonPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { ShortenNamePipe } from './shorten-name.pipe';
import { ShortenAddressPipe } from './shorten-address.pipe';
import { BlockyIdenticonComponent } from './blocky/blocky-identicon.component';
import { WalletFacade } from '../../store/wallet.facade';
import { PushModule } from '@rx-angular/template/push';

@Component({
  selector: 'app-address-display',
  templateUrl: './address-display.component.html',
  styleUrls: ['./address-display.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    JsonPipe,
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
    return false;
  }
}
