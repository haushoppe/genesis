import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-cube-preview-title',
  templateUrl: './cube-preview-title.component.html',
  styleUrls: ['./cube-preview-title.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CubePreviewTitleComponent {
  readonly title = input<string>('');
}
