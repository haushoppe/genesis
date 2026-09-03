import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, inject, provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { Cat21Service, Network, StorageLike, UtxoContentScanner, WalletService } from 'ordpool-sdk';

import { environment } from '../environments/environment';
import { ORDINAL_ROUTES } from './ordinal.routes';
import { bitcoinNetwork, cat21Config } from './shared/sdk-tokens';

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

    // The SDK is framework-agnostic — its services are plain classes taking
    // config in the constructor. These app-local tokens carry cubes-frontend's
    // concrete config; the useFactory providers below construct the SDK
    // classes as root singletons, so call sites keep injecting the class.
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
    // The SDK's stateful classes are plain (no @Injectable) — registered here
    // as root singletons, constructed from the tokens above.
    { provide: Cat21Service, useFactory: () => new Cat21Service(inject(cat21Config), inject(bitcoinNetwork)) },
    { provide: UtxoContentScanner, useFactory: () => new UtxoContentScanner(inject(cat21Config)) },
    { provide: WalletService, useFactory: () => new WalletService({ storage: browserLocalStorage, network: inject(bitcoinNetwork) }) },
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
