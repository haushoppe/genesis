import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Inscription } from '../../ordinalsbot';
import { NgIf } from '@angular/common';
import { SafeResourceUrlPipe } from '../../safe-url.pipe';

@Component({
  selector: 'app-inscription-list-item',
  templateUrl: './inscription-list-item.component.html',
  styleUrls: ['./inscription-list-item.component.scss'],
  standalone: true,
  imports: [
    RouterLink,
    NgIf,
    SafeResourceUrlPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InscriptionListItemComponent {

  @Input() inscription?: Inscription;
}
