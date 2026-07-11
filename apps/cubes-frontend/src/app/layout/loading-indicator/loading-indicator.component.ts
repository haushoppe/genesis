import { Component, input } from '@angular/core';

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
})
export class LoadingIndicatorComponent {
  protected readonly SubmitStatus = SubmitStatus;

  readonly sendDataText = input('Loading…');
  readonly state = input<SubmittableState | null>(getInitialState());
}
