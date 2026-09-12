import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CHROME_CURSE_LABEL } from '../../services/cubes-data/rarity-labels';
import { CubeRarity, InscriptionExtended } from '../../services/cubes-data/types';
import { ToggleIframeDirective } from '../toggle-iframe.directive';

@Component({
  selector: 'app-inscription-list-item',
  templateUrl: './inscription-list-item.component.html',
  styleUrls: ['./inscription-list-item.component.scss'],
  imports: [RouterLink, ToggleIframeDirective],
})
export class InscriptionListItemComponent {
  readonly inscription = input<InscriptionExtended>();

  /** The cube's rarity row; shown under the name when the list is sorted by rarity. */
  readonly rarity = input<CubeRarity | null>(null);

  /** "Rank #12 · 150 points", or what keeps the cube off the leaderboard. */
  protected readonly rarityLine = computed(() => {
    const r = this.rarity();
    if (!r) return null;
    if (r.status === 'scored') return `Rank #${r.rank} · ${r.score} points`;
    if (r.status === 'cursed') return 'Cursed, no score';
    return 'Not scored';
  });

  /** Marks a cube whose sides the browser refuses as a texture (see the details page). */
  protected readonly chromeCursed = computed(() => (this.rarity()?.chromeSides?.length ?? 0) > 0);
  protected readonly chromeCurseLabel = CHROME_CURSE_LABEL;
}
