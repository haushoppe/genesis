import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { WalletConnectComponent } from '../wallet-connect/wallet-connect.component';

@Component({
  // Native element selector on purpose: this component IS the page's <header>.
  selector: 'header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [RouterLink, WalletConnectComponent],
})
export class HeaderComponent {}
