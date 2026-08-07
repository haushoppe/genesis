import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

import { fetchCubeSrcdoc } from '../shared/utils/fetch-cube-content';
import { withDarkColorScheme } from '../shared/utils/with-dark-color-scheme';

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
 * Fetch the cube body on intersection and set it as srcdoc; swap to
 * the placeholder when the iframe leaves the viewport.
 */
@Directive({
  selector: '[appToggleIframe]',
  standalone: true
})
export class ToggleIframeDirective implements OnInit, OnDestroy {

  readonly toggleInscriptionId = input('');

  private readonly element = inject(ElementRef);
  private intersectionObserver: IntersectionObserver | undefined;
  private currentFetch: Promise<void> | null = null;

  ngOnInit() {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const inscriptionId = this.toggleInscriptionId();
        if (!inscriptionId) continue;
        if (entry.isIntersecting) {
          this.applyFetchedSrcdoc(inscriptionId);
        } else {
          this.currentFetch = null;
          this.element.nativeElement.srcdoc = placeholderAsString;
        }
      }
    });

    this.intersectionObserver.observe(this.element.nativeElement);
  }

  ngOnDestroy() {
    this.intersectionObserver?.disconnect();
  }

  private applyFetchedSrcdoc(inscriptionId: string): void {
    this.element.nativeElement.srcdoc = placeholderAsString;
    const fetchPromise = fetchCubeSrcdoc(inscriptionId).then((srcdoc) => {
      // Skip if the observer swapped us mid-flight.
      if (this.currentFetch !== fetchPromise) return;
      this.element.nativeElement.srcdoc = srcdoc;
    }).catch(() => {
      // Placeholder stays.
    });
    this.currentFetch = fetchPromise;
  }
}
