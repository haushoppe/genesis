import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../environments/environment';
import { InscriptionExtended } from '../../services/cubes-data/types';
import { ToggleIframeDirective } from '../toggle-iframe.directive';

@Component({
  selector: 'app-inscription-list-item',
  templateUrl: './inscription-list-item.component.html',
  styleUrls: ['./inscription-list-item.component.scss'],
  imports: [RouterLink, ToggleIframeDirective],
})
export class InscriptionListItemComponent {
  readonly inscription = input<InscriptionExtended>();
  protected readonly environment = environment;
}
