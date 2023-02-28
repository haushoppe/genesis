import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { StrictWalletState } from './strict-wallet-state';

// some concepts taken from these hooks
// https://github.com/blocknative/web3-onboard/blob/d7c037b2d0e5e6ec50b5e7b5177bc444e61d1aa3/packages/react/src/hooks/useConnectWallet.ts

export const WalletActions = createActionGroup({
  source: 'Wallet',
  events: {
    'Connect Wallet': emptyProps(),
    'Connect Wallet Success':  props<{ wallet: StrictWalletState }>(),
    'Connect Wallet Failure': emptyProps(),
    'State Change': props<{ update: StrictWalletState }>(),
    'Disconnect Wallet': emptyProps(),
  }
});
