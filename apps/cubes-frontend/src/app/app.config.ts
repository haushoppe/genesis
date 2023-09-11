import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, isDevMode } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { ActionReducer, provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { environment } from '../environments/environment';
import { ApiModule, Configuration } from './openapi-client';
import { MintEffects } from './store/mint.effects';
import { mintFeature } from './store/mint.reducer';
import { CustomRouteSerializer } from './store/utils-ngrx-router/custom-route-serializer';
import { WalletEffects } from './store/wallet.effects';
import { walletFeature } from './store/wallet.reducer';
import { localStorageSync } from 'ngrx-store-localstorage';
import merge from 'lodash.merge';


const INIT_ACTION = '@ngrx/store/init';
const UPDATE_ACTION = '@ngrx/store/update-reducers';

// bugfix: Rehydratation changes all store references on UPDATE_ACTION
// https://github.com/btroncone/ngrx-store-localstorage/issues/128#issuecomment-613975060
const mergeReducer = (state: any, rehydratedState: any, action: any) => {
  if ((action.type === INIT_ACTION || action.type === UPDATE_ACTION) && rehydratedState) {
    state = merge(state, rehydratedState); // <-- this line was changed to not clone
  }
  return state;
};

export function localStorageSyncReducer(reducer: ActionReducer<any>): ActionReducer<any> {
  return localStorageSync({
    keys: [
      { mint: ['pastOrders', 'pastCreatedInscriptions'] },
      { wallet: ['wallet', 'walletStatus'] },
    ],
    rehydrate: true,
    // mergeReducer,
    storageKeySerializer: (key) => `cube_${key}`
  })(reducer);
}


export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideAnimations(),
    importProvidersFrom(
      ApiModule.forRoot(
        () =>
          new Configuration({
            basePath: environment.api,
          })
      )
    ),
    provideRouter(
      [
        {
          path: '',
          loadChildren: () => import('./ordinal.routes').then((m) => m.ORDINAL_ROUTES),
          providers: [
            provideState(mintFeature),
            provideEffects(MintEffects),
            provideState(walletFeature),
            provideEffects(WalletEffects),
          ],
        },
      ],
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        // anchorScrolling: 'enabled'
      })
    ),

    // NgRx providers
    provideStore({
      router: routerReducer,
    }, {
      metaReducers: [localStorageSyncReducer]
    }),
    provideRouterStore({
      serializer: CustomRouteSerializer,
    }),
    provideStoreDevtools({
      maxAge: 25, // Retains last 25 states
      logOnly: !isDevMode(), // Restrict extension to log-only mode
      autoPause: true, // Pauses recording actions and state changes when the extension window is not open
      trace: false, //  If set to true, will include stack trace for every dispatched action, so you can see it in trace tab jumping directly to that part of code
      traceLimit: 75, // maximum stack trace frames to be stored (in case trace option was provided as true)
    }),
  ],
};
