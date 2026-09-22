import { afterNextRender, Component, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { BANNER_POSTER } from './banner-poster';
import { withSelfHostedBannerAssets } from './banner-self-hosted';
import { SafeHtmlPipe } from '../../safe-html.pipe';
import { getCubeHtml } from '../../services/cube-html';
import { withPreviewDarkCanvas } from '../../shared/utils/preview-dark-canvas';

// The featured cube's sides come from the environment: they are mainnet
// inscriptions in production, and a regtest chain cannot serve them, so a
// hardcoded list renders six 404s per page there.
const BANNER_CUBE_SIDES = environment.bannerCubeSides;

const BANNER_SRCDOC = withPreviewDarkCanvas(withSelfHostedBannerAssets(getCubeHtml({
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
}), BANNER_CUBE_SIDES));

@Component({
  selector: 'app-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
  imports: [SafeHtmlPipe],
})
export class BannerComponent {
  protected readonly bannerSrcdoc = BANNER_SRCDOC;
  protected readonly poster = BANNER_POSTER;

  /** The live cube costs ~253 KB of on-chain fetches (renderer + its three.js
   *  and fflate bundle + one image per side), so it is not part of first
   *  paint. The inlined still frame carries the header until then. */
  protected readonly live = signal(false);

  constructor() {
    afterNextRender(() => {
      // Gate on LOAD, then idle. `afterNextRender` alone fires within
      // milliseconds, so the 253 KB of on-chain fetches would still land
      // inside the window that decides first paint and LCP, and the poster
      // would buy nothing.
      const start = () => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(() => this.live.set(true), { timeout: 3000 });
        else setTimeout(() => this.live.set(true), 200);
      };
      if (document.readyState === 'complete') start();
      else window.addEventListener('load', start, { once: true });
    });
  }
}
