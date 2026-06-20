import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LetModule } from '@rx-angular/template/let';

import { PastFacade } from '../../store/past.facade';

@Component({
  selector: 'app-past-orders-and-inscriptions',
  templateUrl: './past-orders-and-inscriptions.component.html',
  styleUrls: ['./past-orders-and-inscriptions.component.scss'],
  imports: [LetModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PastOrdersAndInscriptionsComponent {
  pastFacade = inject(PastFacade);
}
