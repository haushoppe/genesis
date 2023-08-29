import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { WalletInfo } from './wallet.reducer';

export const WalletActions = createActionGroup({
  source: 'Wallet',
  events: {

    'Connect Wallet': emptyProps(),
    'Connect Wallet Success': props<{ wallet: WalletInfo}>(),
    'Connect Wallet Failure': props<{ message: string }>(),

    'Disconnect Wallet': emptyProps()
  }
});
