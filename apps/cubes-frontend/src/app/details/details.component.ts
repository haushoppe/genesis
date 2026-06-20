import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
  host: {
    '(window:keydown)': 'onKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailsComponent {
  mintFacade = inject(MintFacade);
  router = inject(Router);
  environment = environment;

  getIframeSrc(inscriptionId?: string | undefined): string {
    if (!inscriptionId) {
      return 'about:blank';
    }
    return environment.ordinalsExplorerIframe + inscriptionId + '?cache-buster';
  }

  onKeydown(event: KeyboardEvent) {
    if (isTextInputTarget(event.target)) return;
    const i = this.mintFacade.singleInscription();
    if (event.key === 'ArrowLeft' && i?.previousInscriptionId) {
      this.router.navigate(['/inscription', i.previousInscriptionId]);
    } else if (event.key === 'ArrowRight' && i?.nextInscriptionId) {
      this.router.navigate(['/inscription', i.nextInscriptionId]);
    }
  }
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
