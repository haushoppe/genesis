import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { InscriptionExtended } from '../../services/cubes-data/types';
import { environment } from '../../../../src/environments/environment';
import { ToggleIframeDirective } from '../toggle-iframe.directive';

@Component({
    selector: 'app-inscription-list-item',
    templateUrl: './inscription-list-item.component.html',
    styleUrls: ['./inscription-list-item.component.scss'],
    imports: [
        RouterLink,
        NgIf,
        NgFor,
        ToggleIframeDirective
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InscriptionListItemComponent  {

  @Input() inscription?: InscriptionExtended;
  environment = environment;
}
