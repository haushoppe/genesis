import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { environment } from '../../environments/environment';
import { ShortenAddressPipe } from '../layout/shorten-address.pipe';
import { ToggleIframeDirective } from '../layout/toggle-iframe.directive';
import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { CHROME_CURSE_LABEL, chromeCurseExplanation, curseLabel } from '../services/cubes-data/rarity-labels';
import { RarityService } from '../services/cubes-data/rarity.service';
import { CubeRarity } from '../services/cubes-data/types';
import { rxResourceFixed } from '../shared/utils/rx-resource-fixed';
import { shouldIgnoreListKey } from '../shared/utils/list-key';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
  imports: [
    DatePipe,
    RouterLink,
    ShortenAddressPipe,
    ToggleIframeDirective,
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

  private readonly rarity = inject(RarityService);

  /** This cube's row in the index's rarity score, with the scored total it ranks against. */
  protected readonly rarityResource = rxResourceFixed({
    params: () => ({ id: this.inscriptionId() }),
    stream: ({ params }) => this.rarity.getRarity(params.id),
  });

  protected curseLabel(cube: CubeRarity): string {
    return curseLabel(cube);
  }

  protected readonly chromeCurseLabel = CHROME_CURSE_LABEL;

  /** The faces this browser would leave black without the viewer's redraw. */
  protected readonly chromeSides = computed(() => this.rarityResource.value()?.cube.chromeSides ?? []);

  protected readonly chromeExplanation = computed(() => chromeCurseExplanation(this.chromeSides()));

  onKeydown(event: KeyboardEvent) {
    if (shouldIgnoreListKey(event)) return;
    const i = this.detailsResource.value();
    if (event.key === 'ArrowLeft' && i?.previousInscriptionId) {
      this.router.navigate(['/inscription', i.previousInscriptionId]);
    } else if (event.key === 'ArrowRight' && i?.nextInscriptionId) {
      this.router.navigate(['/inscription', i.nextInscriptionId]);
    }
  }
}


