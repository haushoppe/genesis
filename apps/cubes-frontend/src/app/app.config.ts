import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { ActionReducer, provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { localStorageSync } from 'ngrx-store-localstorage';
import { bitcoinNetwork, cat21Config, Network, StorageLike, storage } from 'ordpool-sdk';

import { environment } from '../environments/environment';
import { ORDINAL_ROUTES } from './ordinal.routes';
import { MintEffects } from './store/mint.effects';
import { mintFeature } from './store/mint.reducer';
import { pastFeature } from './store/past.reducer';
import { CustomRouteSerializer } from './store/utils-ngrx-router/custom-route-serializer';

/**
 * Thin adapter over the browser's localStorage that satisfies the
 * SDK's `StorageLike` contract. WalletService persists
 * LAST_CONNECTED_WALLET through this so a session survives reloads.
 */
const browserLocalStorage: StorageLike = {
  getValue: (key) => localStorage.getItem(key),
  setValue: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};


export function localStorageSyncReducer(reducer: ActionReducer<any>): ActionReducer<any> {
  return localStorageSync({
    keys: ['past'],
    rehydrate: true,
    storageKeySerializer: (key) => `cube_${key}`
  })(reducer);
}


export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideAnimations(),

    // ordpool-sdk DI tokens. Bridges the SDK's framework-agnostic
    // interfaces to cubes-frontend's concrete environment. WalletService
    // + InscribeMintOrchestrator resolve providedIn:'root' — only the
    // tokens need explicit wiring here.
    { provide: storage, useValue: browserLocalStorage },
    { provide: bitcoinNetwork, useValue: environment.mempoolApiUrl.includes('localhost') ? Network.Regtest : Network.Mainnet },
    // cat21ApiUrl is unused by the inscribe flow but the config token
    // is required by Cat21Service's constructor. mempoolApiUrl comes
    // from environment.ts so regtest e2e can point at local electrs
    // (localhost:3000) instead of api.ordpool.space. The workspace
    // HARD RULE bans direct mempool.space calls; nothing here hits it.
    { provide: cat21Config, useValue: {
      mempoolApiUrl: environment.mempoolApiUrl,
      cat21ApiUrl: 'https://backend2.cat21.space',
      ordApiUrl: 'https://ord.ordpool.space',
      cat21OrdApiUrl: 'https://ord.cat21.space',
    } },
    provideRouter(
      ORDINAL_ROUTES,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled'
      })
    ),

    // NgRx: single top-level slice, no per-route lazy providers.
    provideStore({
      router: routerReducer,
    }, {
      metaReducers: [localStorageSyncReducer]
    }),
    provideState(mintFeature),
    provideState(pastFeature),
    provideEffects(MintEffects),
    provideRouterStore({
      serializer: CustomRouteSerializer,
    }),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true,
      trace: false,
      traceLimit: 75,
    }),
  ],
};
