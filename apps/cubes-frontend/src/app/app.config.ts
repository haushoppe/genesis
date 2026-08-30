import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { bitcoinNetwork, cat21Config, Network, StorageLike, storage } from 'ordpool-sdk';

import { environment } from '../environments/environment';
import { ORDINAL_ROUTES } from './ordinal.routes';

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


export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(),
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
    // The two ord URLs feed the SDK's UtxoContentScanner (funding-safety
    // content scan: `${ordApiUrl}/output/<op>` + `${cat21OrdApiUrl}/output/<op>`).
    // Sourced from environment.ts so regtest e2e can point them at a local
    // ord/stub that resolves regtest outpoints; prod/dev keep ord.ordpool.space
    // + ord.cat21.space.
    { provide: cat21Config, useValue: {
      mempoolApiUrl: environment.mempoolApiUrl,
      cat21ApiUrl: 'https://backend2.cat21.space',
      ordApiUrl: environment.ordApiUrl,
      cat21OrdApiUrl: environment.cat21OrdApiUrl,
    } },
    provideRouter(
      ORDINAL_ROUTES,
      withComponentInputBinding(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled'
      })
    ),
  ],
};
