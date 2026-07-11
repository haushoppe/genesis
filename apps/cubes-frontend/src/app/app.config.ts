import { HttpRequest, HttpResponse, HttpEventType, provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { ApplicationConfig, isDevMode, provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
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
    provideZonelessChangeDetection(),
    provideHttpClient(
      withXhr(),
      withInterceptors([
        // Broadcast diagnostic: log every POST /api/tx round-trip so
        // we can see exactly what the SDK sends and what electrs
        // responds. Prior CI runs showed state='success' with empty
        // commit/reveal txids — this interceptor pinpoints whether
        // the request body is malformed, the response body is empty,
        // or something else swallows the txid.
        (req, next) => {
          if (req.method === 'POST' && req.url.includes('/api/tx')) {
            const bodyLen = typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body ?? '').length;
            const bodyPreview = typeof req.body === 'string' ? req.body.slice(0, 40) : String(req.body).slice(0, 40);
            // eslint-disable-next-line no-console
            console.warn(`[BROADCAST-DEBUG] POST ${req.url} bodyLen=${bodyLen} preview="${bodyPreview}..."`);
            return next(req).pipe(
              tap({
                next: (event) => {
                  if (event.type === HttpEventType.Response) {
                    const resp = event as HttpResponse<unknown>;
                    const bodyStr = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
                    // eslint-disable-next-line no-console
                    console.warn(`[BROADCAST-DEBUG] RESP status=${resp.status} bodyLen=${bodyStr?.length ?? 0} body="${bodyStr?.slice(0, 100)}"`);
                  }
                },
                error: (err) => {
                  // eslint-disable-next-line no-console
                  console.warn(`[BROADCAST-DEBUG] ERROR status=${err.status} message="${err.message}" body="${err.error?.slice?.(0, 100) ?? err.error}"`);
                },
              }),
            );
          }
          return next(req);
        },
      ]),
    ),
    provideAnimationsAsync(),

    // ordpool-sdk DI tokens. Bridges the SDK's framework-agnostic
    // interfaces to cubes-frontend's concrete environment. WalletService
    // + InscribeMintOrchestrator resolve providedIn:'root' — only the
    // tokens need explicit wiring here.
    { provide: storage, useValue: browserLocalStorage },
    // Regtest env sets mempoolApiUrl to '' (same-origin proxied);
    // mainnet/prod use https://api.ordpool.space. Empty string is
    // the regtest fingerprint.
    { provide: bitcoinNetwork, useValue: environment.mempoolApiUrl === '' ? Network.Regtest : Network.Mainnet },
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
