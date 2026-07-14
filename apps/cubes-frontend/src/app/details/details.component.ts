import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { environment } from '../../environments/environment';
import { ShortenAddressPipe } from '../layout/shorten-address.pipe';
import { SafeUrlPipe } from '../safe-url.pipe';
import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { rxResourceFixed } from '../shared/utils/rx-resource-fixed';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
  imports: [
    RouterLink,
    SafeUrlPipe,
    ShortenAddressPipe,
  ],
  host: {
    '(window:keydown)': 'onKeydown($event)',
  },
})
export class DetailsComponent {
  /** Route param `/inscription/:inscriptionId` bound via
   *  `withComponentInputBinding()`. Angular guarantees a value (the
   *  route matcher won't fire otherwise), so `input.required` is
   *  correct. */
  readonly inscriptionId = input.required<string>();

  private readonly cubesData = inject(CubesDataService);
  private readonly router = inject(Router);
  protected readonly environment = environment;

  protected readonly detailsResource = rxResourceFixed({
    params: () => ({ id: this.inscriptionId() }),
    stream: ({ params }) => this.cubesData.getSingleInscription(params.id),
  });

  getIframeSrc(inscriptionId?: string | undefined): string {
    if (!inscriptionId) {
      return 'about:blank';
    }
    return environment.ordinalsExplorerIframe + inscriptionId + '?cache-buster';
  }

  onKeydown(event: KeyboardEvent) {
    if (isTextInputTarget(event.target)) return;
    const i = this.detailsResource.value();
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
