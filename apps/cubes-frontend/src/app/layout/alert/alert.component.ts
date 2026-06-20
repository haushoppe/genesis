import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-alert',
  templateUrl: './alert.component.html',
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertComponent {
  @Input() type: 'primary' | 'success' | 'warning' | 'danger' = 'warning';
}
