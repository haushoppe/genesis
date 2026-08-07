import { Component, DestroyRef, ElementRef, inject, viewChild, effect } from '@angular/core';

import { fetchCubeSrcdoc } from '../../shared/utils/fetch-cube-content';

/**
 * Featured cube in the site header. Fixed on-chain id — the same
 * "colorful sample" cube the site has always used. Historically this
 * was an `<iframe src="https://ordinals.com/preview/…">` — cross-
 * origin, so the iframe canvas painted white on mobile Chrome for
 * the seconds before the cube JS scene rendered. Now we fetch the
 * inscription body ourselves (CORS-enabled ord.ordpool.space), wrap
 * it with a dark-color-scheme shell, and `srcdoc` the result — dark
 * canvas from first paint.
 */
const BANNER_CUBE_ID = '00ef588330b57ba4586365c9a3663e14bcc14452819ae6c09f99eec291435831i0';

@Component({
  selector: 'app-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
})
export class BannerComponent {
  private readonly iframeRef = viewChild.required<ElementRef<HTMLIFrameElement>>('iframeEl');

  constructor() {
    // Fetch once on component init, apply srcdoc when it lands.
    // Cached by id in fetchCubeSrcdoc, so if some other page already
    // fetched this cube this resolves instantly.
    effect((onCleanup) => {
      const iframe = this.iframeRef().nativeElement;
      let cancelled = false;
      onCleanup(() => { cancelled = true; });
      fetchCubeSrcdoc(BANNER_CUBE_ID).then((srcdoc) => {
        if (!cancelled) iframe.srcdoc = srcdoc;
      }).catch(() => {
        // Silent fallback: static empty srcdoc keeps the frame dark
        // (color-scheme meta injected), no cube rendered but no white
        // rectangle either. Rare — this endpoint is our own.
        if (!cancelled) iframe.srcdoc = '<html><head><meta name="color-scheme" content="dark"></head><body></body></html>';
      });
    });
  }
}
