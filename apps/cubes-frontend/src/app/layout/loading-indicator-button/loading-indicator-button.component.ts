import { Component, input, output } from '@angular/core';

import { SubmitStatus } from '../../store/submittable/submit-status';
import {
  getInitialState,
  SubmittableState,
} from '../../store/submittable/submittable-state';
import { AlertComponent } from '../alert/alert.component';

@Component({
  selector: 'app-loading-indicator-button',
  templateUrl: './loading-indicator-button.component.html',
  imports: [AlertComponent],
})
export class LoadingIndicatorButtonComponent {
  protected readonly SubmitStatus = SubmitStatus;

  readonly disabled = input(false);
  readonly buttonText = input('Send');
  readonly defaultIconClass = input('bi bi-send');
  readonly state = input<SubmittableState | null>(getInitialState());
  readonly showAlertOnError = input(false);

  readonly buttonClick = output<MouseEvent>();
}
