import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SafeHtmlPipe } from '../../safe-html.pipe';
import { CubeDetails, getCubeHtml } from '../../services/cube-html';

type CubeDetailsInput = Omit<CubeDetails, 'title'>;

const DEFAULT_CUBE_DETAILS: CubeDetailsInput = {
  inscriptionIds: {
    inscriptionId1: '',
    inscriptionId2: '',
    inscriptionId3: '',
    inscriptionId4: '',
    inscriptionId5: '',
    inscriptionId6: '',
  },
  rotationSpeedX: '',
  rotationSpeedY: '',
  colorPane: '',
  bgColor1: '',
  bgColor2: '',
};

@Component({
  selector: 'app-cube-preview',
  templateUrl: './cube-preview.component.html',
  styleUrls: ['./cube-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeHtmlPipe],
})
export class CubePreviewComponent {
  readonly cubeDetails = input<CubeDetailsInput>(DEFAULT_CUBE_DETAILS);

  protected readonly cubeHtml = computed(() =>
    getCubeHtml({ ...this.cubeDetails(), title: '' }),
  );
}
