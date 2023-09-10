import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { WalletInfo } from './wallet.reducer';

export const WalletActions = createActionGroup({
  source: 'Wallet',
  events: {

    'Installed Wallets Changed': props<{ installedWallets: {
      label: string;
      logo: string;
    }[]}>(),

    'Connect Wallet': emptyProps(),
    'Connect Wallet Success': props<{ wallet: WalletInfo}>(),
    'Connect Wallet Failure': props<{ message: string }>(),

    'Disconnect Wallet': emptyProps()
  }
});
