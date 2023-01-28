import { HttpClientModule } from '@angular/common/http';
import { enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app/app.component';
import { ScalesComponent } from './app/scales/scales.component';
import { StartComponent } from './app/start/start.component';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent,{
  providers: [
    importProvidersFrom(HttpClientModule),
    importProvidersFrom(RouterModule.forRoot([
      { path: '', component: StartComponent },
      { path: 'scales', component: ScalesComponent }
    ]))
  ]
})
.catch((err) => console.error(err));
