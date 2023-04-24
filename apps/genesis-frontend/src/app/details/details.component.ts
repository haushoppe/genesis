import { AsyncPipe, JsonPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LetModule } from '@rx-angular/template/let';
import { PushModule } from '@rx-angular/template/push';

import { AddressDisplayComponent } from '../layout/address-display/address-display.component';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { MintFacade } from '../store/mint.facade';
import { ParseMarkdownPipe } from './parse-markdown.pipe';
import { SafeResourceUrlPipe } from './safe-url.pipe';
import { LinkifyDirective } from './linkify.directive';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
  standalone: true,
  imports: [
    AsyncPipe,
    LoadingIndicatorComponent,
    NgIf,
    ParseMarkdownPipe,
    RouterLink,
    SafeResourceUrlPipe,
    JsonPipe,
    LetModule,
    PushModule,
    AddressDisplayComponent,
    LinkifyDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DetailsComponent {
  mintFacade = inject(MintFacade);
}
