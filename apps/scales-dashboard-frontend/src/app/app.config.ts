import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { ScalesComponent } from './scales/scales.component';
import { StartComponent } from './start/start.component';


export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideRouter(
      [
        { path: '', component: StartComponent },
        { path: 'scales', component: ScalesComponent },
      ],
      withInMemoryScrolling({ scrollPositionRestoration: 'top' })
    ),
  ],
};
