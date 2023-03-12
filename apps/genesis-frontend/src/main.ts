import { provideHttpClient } from '@angular/common/http';
import { enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { AppComponent } from './app/app.component';
import { ApiModule, Configuration } from './app/openapi-client';
import { MintEffects } from './app/store/mint.effects';
import { mintFeature } from './app/store/mint.reducer';
import { CustomRouteSerializer } from './app/store/utils-ngrx-router/custom-route-serializer';
import { WalletEffects } from './app/store/wallet.effects';
import { walletFeature } from './app/store/wallet.reducer';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent,{
  providers: [
    provideHttpClient(),
    provideAnimations(),
    importProvidersFrom(ApiModule.forRoot(() => new Configuration({
      basePath: environment.api
    }))),
    provideRouter([
      { path: '',
        loadChildren: () => import('./nft.routes').then(m => m.NFT_ROUTES),
        providers: [
          provideState(mintFeature),
          provideEffects(MintEffects),
          provideState(walletFeature),
          provideEffects(WalletEffects)
      ]}
    ],
    withInMemoryScrolling({ scrollPositionRestoration: 'top' })),

    // NgRx providers
    provideStore({
      router: routerReducer,
    }),
    provideRouterStore({
      serializer: CustomRouteSerializer
    }),
    provideStoreDevtools({
      maxAge: 25, // Retains last 25 states
      logOnly: !isDevMode(), // Restrict extension to log-only mode
      autoPause: true, // Pauses recording actions and state changes when the extension window is not open
      trace: false, //  If set to true, will include stack trace for every dispatched action, so you can see it in trace tab jumping directly to that part of code
      traceLimit: 75, // maximum stack trace frames to be stored (in case trace option was provided as true)
    })
  ]
})
.catch((err) => console.error(err));
