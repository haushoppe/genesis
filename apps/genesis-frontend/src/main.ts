import { provideHttpClient } from '@angular/common/http';
import { enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { AppComponent } from './app/app.component';
import { DetailsComponent } from './app/details/details.component';
import { ApiModule, Configuration } from './app/openapi-client';
import { StartComponent } from './app/start/start.component';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent,{
  providers: [
    provideHttpClient(),
    importProvidersFrom(ApiModule.forRoot(() => new Configuration({
      basePath: environment.api
    }))),
    provideRouter([
      { path: '', component: StartComponent },
      { path: 'nft/:tokenId', component: DetailsComponent }
    ],
    withInMemoryScrolling({ scrollPositionRestoration: 'top' }))
  ]
})
.catch((err) => console.error(err));
