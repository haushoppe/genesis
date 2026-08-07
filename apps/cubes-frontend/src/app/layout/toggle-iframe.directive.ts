import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

import { fetchCubeSrcdoc } from '../shared/utils/fetch-cube-content';
import { withDarkColorScheme } from '../shared/utils/with-dark-color-scheme';

/**
 * Loading placeholder shown while a tile is out of viewport (or its
 * fetch hasn't landed yet). Dark gradient matches the app; the
 * "Loading …" message is honest about state without being alarming.
 */
export const placeholderAsString = withDarkColorScheme(
`<html>
  <head>
    <style>
      html,body {
        width: 100%;
        height: 100%;
        margin: 0;
      }
      body {
        background-color: #000000;
        background-image: linear-gradient(180deg, transparent 52%, black 52%, #212121 90%),
        linear-gradient(180deg, #000000 20%, #5a5a5a 80%);
      }
    </style>
  </head>
  <body>
  </body>
</html>`,
);

/**
 * Lazy iframe loader. When the tile scrolls into viewport, fetch the
 * cube's on-chain HTML from `ord.ordpool.space/content/<id>` and set
 * it as `srcdoc` (wrapped with dark-colour-scheme meta). Out of
 * viewport → swap to the placeholder to free the iframe's resources.
 *
 * Why fetch+srcdoc instead of a cross-origin `src`: on mobile Chrome
 * whose OS `prefers-color-scheme` is light, a cross-origin src iframe
 * paints its canvas WHITE until the loaded document paints its own
 * bg. Cube inscription HTML sets no body-bg, so the flash lasts the
 * full seconds it takes the cube JS to build its 3D scene. Injecting
 * `<meta name="color-scheme" content="dark">` at fetch time gives us
 * a dark canvas from first paint. See `withDarkColorScheme` for the
 * full rationale.
 *
 * The directive accepts `toggleInscriptionId` (preferred — enables
 * the flash-fix) OR `toggleSrc` / `toggleSrcDoc` (legacy — kept for
 * callers we haven't migrated yet; still white-flash-prone).
 */
@Directive({
  selector: '[appToggleIframe]',
  standalone: true
})
export class ToggleIframeDirective implements OnInit, OnDestroy {

  /** Inscription id whose /content/ body will be fetched and srcdoc'd
   *  when the iframe scrolls into view. Preferred over `toggleSrc`. */
  readonly toggleInscriptionId = input('');

  /** Legacy cross-origin URL — sets `src` directly. Kept for callers
   *  that haven't migrated to `toggleInscriptionId` yet. */
  readonly toggleSrc = input('');

  /** Legacy pre-built srcdoc string. Should already be wrapped with
   *  the color-scheme meta if the caller cares about the flash. */
  readonly toggleSrcDoc = input('');

  private readonly element = inject(ElementRef);
  private intersectionObserver: IntersectionObserver | undefined;
  private currentFetch: Promise<void> | null = null;

  ngOnInit() {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const inscriptionId = this.toggleInscriptionId();
        const src = this.toggleSrc();
        const srcDoc = this.toggleSrcDoc();

        if (inscriptionId) {
          if (entry.isIntersecting) {
            this.applyFetchedSrcdoc(inscriptionId);
          } else {
            this.currentFetch = null;
            this.element.nativeElement.srcdoc = placeholderAsString;
          }
        } else if (src) {
          this.element.nativeElement.src = entry.isIntersecting ? src : '/assets/placeholder.html';
        } else if (srcDoc) {
          this.element.nativeElement.srcdoc = entry.isIntersecting ? srcDoc : placeholderAsString;
        }
      }
    });

    this.intersectionObserver.observe(this.element.nativeElement);
  }

  ngOnDestroy() {
    this.intersectionObserver?.disconnect();
  }

  private applyFetchedSrcdoc(inscriptionId: string): void {
    // Show the dark placeholder immediately so the tile is never
    // white while the fetch is in flight (mobile networks add 500ms-
    // 2s just for TLS + DNS on first hit).
    this.element.nativeElement.srcdoc = placeholderAsString;
    const fetchPromise = fetchCubeSrcdoc(inscriptionId).then((srcdoc) => {
      // Guard against a stale fetch overwriting a newer one — if the
      // observer swapped us out of view (or to a different id) while
      // we were awaiting, do nothing.
      if (this.currentFetch !== fetchPromise) return;
      this.element.nativeElement.srcdoc = srcdoc;
    }).catch(() => {
      // Silent — placeholder stays visible on failure.
    });
    this.currentFetch = fetchPromise;
  }
}
