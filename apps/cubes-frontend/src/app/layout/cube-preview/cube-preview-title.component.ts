import { Component, input } from '@angular/core';

@Component({
  selector: 'app-cube-preview-title',
  templateUrl: './cube-preview-title.component.html',
  styleUrls: ['./cube-preview-title.component.scss'],
  imports: [],
})
export class CubePreviewTitleComponent {
  readonly title = input<string>('');
}
