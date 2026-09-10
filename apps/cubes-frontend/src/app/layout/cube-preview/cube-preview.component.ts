import { Component, computed, input } from '@angular/core';

import { SafeHtmlPipe } from '../../safe-html.pipe';
import { CubeDetails, getCubeHtml } from '../../services/cube-html';
import { withPreviewDarkCanvas } from '../../shared/utils/preview-dark-canvas';

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
  // Force title='' so the caller's title never leaks into the iframe;
  // the page renders it separately via <app-cube-preview-title>.
  readonly cubeDetails = input<CubeDetails>(DEFAULT_CUBE_DETAILS);

  // Live preview of an un-inscribed cube. The exact bytes we would mint are
  // `getCubeHtml(...)`; here we add a DISPLAY-ONLY dark-canvas meta so the
  // iframe does not flash white on each keystroke. The minted body
  // (start.component `cubeBody`) uses `getCubeHtml` directly and stays
  // pristine.
  protected readonly cubeSrcdoc = computed(() =>
    withPreviewDarkCanvas(getCubeHtml({ ...this.cubeDetails(), title: '' })),
  );
}
