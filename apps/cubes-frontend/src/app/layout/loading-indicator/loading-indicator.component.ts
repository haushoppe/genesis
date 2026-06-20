import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { SubmitStatus } from '../../store/submittable/submit-status';
import {
  getInitialState,
  SubmittableState,
} from '../../store/submittable/submittable-state';
import { AlertComponent } from '../alert/alert.component';

@Component({
  selector: 'app-loading-indicator',
  templateUrl: './loading-indicator.component.html',
  imports: [AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingIndicatorComponent {
  SubmitStatus = SubmitStatus;

  @Input() sendDataText = 'Loading…';
  @Input() state: SubmittableState | null = getInitialState();
}
