import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { WalletConnectComponent } from '../wallet-connect/wallet-connect.component';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [RouterLink, WalletConnectComponent],
})
export class HeaderComponent {}
