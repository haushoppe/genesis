import { Component, computed, input } from '@angular/core';

import { SafeHtmlPipe } from '../../safe-html.pipe';
import { CubeDetails, getCubeHtml } from '../../services/cube-html';

const DEFAULT_CUBE_DETAILS: CubeDetails = {
  inscriptionIds: {
    inscriptionId1: '',
    inscriptionId2: '',
    inscriptionId3: '',
    inscriptionId4: '',
    inscriptionId5: '',
    inscriptionId6: '',
  },
  title: '',
  rotationSpeedX: '',
  rotationSpeedY: '',
  colorPane: '',
  bgColor1: '',
  bgColor2: '',
};

@Component({
  selector: 'app-cube-preview',
  templateUrl: './cube-preview.component.html',
  imports: [SafeHtmlPipe],
})
export class CubePreviewComponent {
  /** Preview always renders with an empty title so the caller's
   *  title never leaks into the iframe — the surrounding page shows
   *  the title separately via `<app-cube-preview-title>`. */
  readonly cubeDetails = input<CubeDetails>(DEFAULT_CUBE_DETAILS);

  protected readonly cubeHtml = computed(() =>
    getCubeHtml({ ...this.cubeDetails(), title: '' }),
  );
}
