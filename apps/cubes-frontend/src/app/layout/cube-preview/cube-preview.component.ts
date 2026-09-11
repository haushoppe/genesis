import { Component, computed, input } from '@angular/core';

import { SafeHtmlPipe } from '../../safe-html.pipe';
import { CubeDetails, getCubeHtml } from '../../services/cube-html';
import { DARK_PLACEHOLDER_SRCDOC } from '../../shared/utils/cube-srcdoc';
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
  // null = nothing to preview yet (no complete cube and no one customizing):
  // the iframe then shows the empty stage, never placeholder faces.
  readonly cubeDetails = input<CubeDetails | null>(DEFAULT_CUBE_DETAILS);

  // Live preview of an un-inscribed cube. The exact bytes we would mint are
  // `getCubeHtml(...)`; here we add a DISPLAY-ONLY dark-canvas meta so the
  // iframe does not flash white on each keystroke. The minted body
  // (start.component `cubeBody`) uses `getCubeHtml` directly and stays
  // pristine.
  protected readonly cubeSrcdoc = computed(() => {
    const details = this.cubeDetails();
    return details ? withPreviewDarkCanvas(getCubeHtml({ ...details, title: '' })) : DARK_PLACEHOLDER_SRCDOC;
  });
}
