import { Component } from '@angular/core';

import { SafeHtmlPipe } from '../../safe-html.pipe';
import { getCubeHtml } from '../../services/cube-html';
import { withDarkColorScheme } from '../../shared/utils/with-dark-color-scheme';

/**
 * The six sides of the on-chain featured cube (inscription
 * `00ef588330b…`). Frozen — this cube never changes and predates
 * everything else on the site. Fetched once from
 * `ordinals.com/content/00ef…` in Aug 2026 and hardcoded here to
 * kill the network round-trip on every page load — the raw body is
 * only 557 bytes, but even one fetch on the header component blocks
 * paint until it lands. The cube's own inline JS still fetches the
 * cube renderer script from `/content/RENDERER` (relative), which
 * the parent host redirects to whatever ord instance serves it.
 */
const BANNER_CUBE_SIDES = [
  '0a595eb00dffb649952951e76fa5cdd1032d621a91f1d75402eec692bb567da2i0',
  '31ad74da8f8162696570a538e51956d659ed8ba5af21ea6dd667eb7b54298ee5i0',
  '8f6d156fb339697f67adcfd54ae300a7b9f8a7f1f36c9cc6f79960508a9da881i0',
  '30078f5394421c1593be2c06c7ca890c53ccc017550dc019e0c8a37a5f563cbei0',
  '9a397c46bd6a547f697e186fa803bb71f2d7c58b62b733f7b1411ebf9fc88efdi0',
  'b53e29d74eb41d7720760cb9c1b93eb9be0eaadbcf086aea0172672f6cce82aei0',
];

/**
 * Featured cube in the site header. Built at module-load time from
 * `getCubeHtml` with the frozen banner sides + wrapped in the dark
 * colour-scheme display shell — same shape as any minted cube would
 * produce. `srcdoc` is bound statically, so the iframe canvas paints
 * dark from the first frame and the cube JS starts executing without
 * a network round-trip on our side.
 */
const BANNER_SRCDOC = withDarkColorScheme(getCubeHtml({
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
