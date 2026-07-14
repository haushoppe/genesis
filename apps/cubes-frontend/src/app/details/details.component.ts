import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  readonly inscriptionId = input<string>('');

  private readonly cubesData = inject(CubesDataService);
  private readonly router = inject(Router);
  protected readonly environment = environment;

  protected readonly detailsResource = rxResourceFixed({
    params: () => ({ id: this.inscriptionId() }),
    stream: ({ params }) => this.cubesData.getSingleInscription(params.id),
  });

  protected readonly details = computed(() => this.detailsResource.value() ?? null);

  getIframeSrc(inscriptionId?: string | undefined): string {
    if (!inscriptionId) {
      return 'about:blank';
    }
    return environment.ordinalsExplorerIframe + inscriptionId + '?cache-buster';
  }

  onKeydown(event: KeyboardEvent) {
    if (isTextInputTarget(event.target)) return;
    const i = this.details();
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
