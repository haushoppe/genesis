import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  templateUrl: './loading-indicator.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingIndicatorComponent {
  @Input() text = 'Loading…';
}
