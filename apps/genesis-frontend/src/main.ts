import { HttpClientModule } from '@angular/common/http';
import { enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

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
    importProvidersFrom(HttpClientModule),
    importProvidersFrom(ApiModule.forRoot(() => new Configuration({
      basePath: environment.api
    }))),
    importProvidersFrom(RouterModule.forRoot([
      { path: '', component: StartComponent },
      { path: 'details/:tokenId', component: DetailsComponent }
    ]))
  ]
})
.catch((err) => console.error(err));
