import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter, map, switchMap } from 'rxjs';

import { BannerComponent } from './layout/banner/banner.component';
import { FooterComponent } from './layout/footer/footer.component';
import { HeaderComponent } from './layout/header/header.component';
import { CustomScrollService } from './custom-scroll.service';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'body',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-bs-theme': 'dark',
  },
  imports: [
    BannerComponent,
    FooterComponent,
    HeaderComponent,
    RouterOutlet,
  ],
})
export class AppComponent {
  customScroll = inject(CustomScrollService);

  router = inject(Router);

  hideBanner = toSignal(
    this.router.events.pipe(
      filter((event: any) => event instanceof NavigationEnd),
      switchMap((event: NavigationEnd) => {
        let route = this.router.routerState.root;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route.data;
      }),
      map((data) => !!data['hideBanner']),
    ),
    { initialValue: false },
  );
}
