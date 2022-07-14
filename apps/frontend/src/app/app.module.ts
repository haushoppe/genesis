import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { FooterComponent } from './footer/footer.component';
import { HeaderComponent } from './header/header.component';
import { ScalesComponent } from './scales/scales.component';
import { StartComponent } from './start/start.component';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    RouterModule.forRoot([
      { path: '', component: StartComponent },
      { path: 'scales', component: ScalesComponent }
    ],
    { initialNavigation: 'enabledBlocking' }),
    HeaderComponent,
    FooterComponent
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
