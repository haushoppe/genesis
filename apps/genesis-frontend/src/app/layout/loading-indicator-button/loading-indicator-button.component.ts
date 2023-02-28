import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { SubmitStatus } from '../../store/submittable/submit-status';
import { initialSubmittableState, SubmittableState } from '../../store/submittable/submittable-state';

@Component({
  selector: 'app-loading-indicator-button',
  templateUrl: './loading-indicator-button.component.html',
  standalone: true,
  imports: [
    NgIf, NgClass
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingIndicatorButtonComponent {

  SubmitStatus = SubmitStatus;

  @Input() disabled = false;
  @Input() buttonText = 'Send';
  @Input() defaultIconClass = 'bi bi-send';
  @Input() state: SubmittableState | null = { ...initialSubmittableState };

  @Output() buttonClick = new EventEmitter<MouseEvent>();

}
