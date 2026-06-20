import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../src/environments/environment';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { ShortenAddressPipe } from '../layout/shorten-address.pipe';
import { SafeUrlPipe } from '../safe-url.pipe';
import { MintFacade } from '../store/mint.facade';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
  imports: [
    LoadingIndicatorComponent,
    RouterLink,
    SafeUrlPipe,
            ShortenAddressPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailsComponent {
  mintFacade = inject(MintFacade);
  environment = environment;

  getIframeSrc(inscriptionId?: string | undefined): string {
    if (!inscriptionId) {
      return 'about:blank';
    }
    return environment.ordinalsExplorerIframe + inscriptionId + '?cache-buster';
  }
}
