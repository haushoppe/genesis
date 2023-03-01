import { HttpErrorResponse } from '@angular/common/http';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { KnownTokenResponse } from '../openapi-client';
import { StrictWalletState } from './helper/strict-wallet-state';

// some concepts taken from these hooks
// https://github.com/blocknative/web3-onboard/blob/d7c037b2d0e5e6ec50b5e7b5177bc444e61d1aa3/packages/react/src/hooks/useConnectWallet.ts

export const WalletActions = createActionGroup({
  source: 'Wallet',
  events: {
    'Load Token Config': emptyProps(),
    'Load Token Config Success':  props<{ knownToken: KnownTokenResponse }>(),
    'Load Token Config Failure':  props<{ error: HttpErrorResponse }>(),

    'Connect Wallet': emptyProps(),
    'Connect Wallet Success':  props<{ wallet: StrictWalletState }>(),
    'Connect Wallet Failure': emptyProps(),

    'Wallet State Change': props<{ wallet: StrictWalletState }>(),

    'Disconnect Wallet': emptyProps(),
    'Disconnect Wallet Done': emptyProps(),
    'Disconnect Wallet Detected': emptyProps()
  }
});
