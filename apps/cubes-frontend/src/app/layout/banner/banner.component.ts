import { Component } from '@angular/core';

import { environment } from '../../../environments/environment';
import { SafeHtmlPipe } from '../../safe-html.pipe';
import { getCubeHtml } from '../../services/cube-html';
import { withPreviewDarkCanvas } from '../../shared/utils/preview-dark-canvas';

// The featured cube's sides come from the environment: they are mainnet
// inscriptions in production, and a regtest chain cannot serve them, so a
// hardcoded list renders six 404s per page there.
const BANNER_CUBE_SIDES = environment.bannerCubeSides;

const BANNER_SRCDOC = withPreviewDarkCanvas(getCubeHtml({
  inscriptionIds: {
    inscriptionId1: BANNER_CUBE_SIDES[0],
    inscriptionId2: BANNER_CUBE_SIDES[1],
    inscriptionId3: BANNER_CUBE_SIDES[2],
    inscriptionId4: BANNER_CUBE_SIDES[3],
    inscriptionId5: BANNER_CUBE_SIDES[4],
    inscriptionId6: BANNER_CUBE_SIDES[5],
  },
  title: '',
  rotationSpeedX: '',
  rotationSpeedY: '',
  colorPane: '',
  bgColor1: '',
  bgColor2: '',
}));

@Component({
  selector: 'app-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
  imports: [SafeHtmlPipe],
})
export class BannerComponent {
  protected readonly bannerSrcdoc = BANNER_SRCDOC;
}
