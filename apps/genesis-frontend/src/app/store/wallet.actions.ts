import { createActionGroup, emptyProps } from '@ngrx/store';

export const WalletActions = createActionGroup({
  source: 'Wallet',
  events: {
    'Connect Wallet': emptyProps(),
  }
});
