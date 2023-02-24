import { provideHttpClient } from '@angular/common/http';
import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { AppComponent } from './app/app.component';
import { ScalesComponent } from './app/scales/scales.component';
import { StartComponent } from './app/start/start.component';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent,{
  providers: [
    provideHttpClient(),
    provideRouter([
      { path: '', component: StartComponent },
      { path: 'scales', component: ScalesComponent }
    ],
    withInMemoryScrolling({ scrollPositionRestoration: 'top' }))
  ]
})
.catch((err) => console.error(err));
