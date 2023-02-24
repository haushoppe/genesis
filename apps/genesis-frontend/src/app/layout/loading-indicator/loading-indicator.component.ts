import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { SubmitStatus } from '../../store/submit-status';
import { initialSubmittableState, SubmittableState } from '../../store/submittable-state';
import { AlertComponent } from './alert/alert.component';

@Component({
  selector: 'app-loading-indicator',
  templateUrl: './loading-indicator.component.html',
  standalone: true,
  imports: [
    NgIf, AlertComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingIndicatorComponent {

  SubmitStatus = SubmitStatus;

  @Input() sendDataText = 'Loading…';
  @Input() state: SubmittableState | null = { ...initialSubmittableState };

}
