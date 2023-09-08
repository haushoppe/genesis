import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-cube-preview-title',
  templateUrl: './cube-preview-title.component.html',
  styleUrls: ['./cube-preview-title.component.scss'],
  standalone: true,
  imports: [
    NgIf
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CubePreviewTitleComponent {

  @Input() title: string = '';
}
