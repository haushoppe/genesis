import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SafeResourceUrlPipe } from '../../safe-url.pipe';
import { InscriptionSimple } from '../../openapi-client';
import { environment } from '../../../../src/environments/environment';

@Component({
  selector: 'app-inscription-list-item',
  templateUrl: './inscription-list-item.component.html',
  styleUrls: ['./inscription-list-item.component.scss'],
  standalone: true,
  imports: [
    RouterLink,
    NgIf,
    NgFor,
    SafeResourceUrlPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InscriptionListItemComponent {

  @Input() inscription?: InscriptionSimple;
  environment = environment
}
