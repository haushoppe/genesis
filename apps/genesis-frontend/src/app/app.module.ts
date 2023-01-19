import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { BannerComponent } from './banner/banner.component';
import { FooterComponent } from './footer/footer.component';
import { HeaderComponent } from './header/header.component';
import { MemberComponent } from './member/member.component';
import { StartComponent } from './start/start.component';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    RouterModule.forRoot([
      { path: '', component: StartComponent },
      { path: 'member', component: MemberComponent }
    ],
    { initialNavigation: 'enabledBlocking' }),
    HttpClientModule,
    BannerComponent,
    HeaderComponent,
    FooterComponent
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
