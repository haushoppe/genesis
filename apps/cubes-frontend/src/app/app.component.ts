import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { BannerComponent } from './layout/banner/banner.component';
import { FooterComponent } from './layout/footer/footer.component';
import { HeaderComponent } from './layout/header/header.component';
import { CustomScrollService } from './custom-scroll.service';
import { map } from 'rxjs';
import { PushModule } from '@rx-angular/template/push';
import { NgIf } from '@angular/common';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'body',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    BannerComponent,
    FooterComponent,
    HeaderComponent,
    RouterOutlet,
    PushModule,
    NgIf
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  customScroll = inject(CustomScrollService);
  hideBanner$ = inject(ActivatedRoute).paramMap.pipe(
    map(x => !!x.get('hideBanner'))
  )
}
