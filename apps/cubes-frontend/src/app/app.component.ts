import { RxPush } from '@rx-angular/template/push';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { BannerComponent } from './layout/banner/banner.component';
import { FooterComponent } from './layout/footer/footer.component';
import { HeaderComponent } from './layout/header/header.component';
import { CustomScrollService } from './custom-scroll.service';
import { filter, map, switchMap } from 'rxjs';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'body',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [
    BannerComponent,
    FooterComponent,
    HeaderComponent,
    RouterOutlet,
    RxPush,
  ],
})
export class AppComponent {
  customScroll = inject(CustomScrollService);

  router = inject(Router);

  hideBanner$ = this.router.events.pipe(
    filter((event: any) => event instanceof NavigationEnd),
    switchMap((event: NavigationEnd) => {
      let route = this.router.routerState.root;
      while (route.firstChild) {
        route = route.firstChild;
      }
      return route.data;
    }),
    map((data) => !!data.hideBanner)
  );
}
