import { Directive, ElementRef, effect, inject, input, DestroyRef } from '@angular/core';

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
 * the placeholder when the iframe leaves the viewport. Also re-fetches
 * on `toggleInscriptionId` change so a reused iframe (details-page
 * prev/next) shows the new cube instead of stale content.
 */
@Directive({
  selector: '[appToggleIframe]',
  standalone: true
})
export class ToggleIframeDirective {

  readonly toggleInscriptionId = input('');

  private readonly element = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private intersectionObserver: IntersectionObserver | undefined;
  private currentFetch: Promise<void> | null = null;
  private isIntersecting = false;
  private appliedId = '';

  constructor() {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        this.isIntersecting = entry.isIntersecting;
        this.reconcile();
      }
    });
    this.intersectionObserver.observe(this.element.nativeElement);
    this.destroyRef.onDestroy(() => this.intersectionObserver?.disconnect());

    // Re-fetch when the input signal changes while the iframe stays visible.
    effect(() => {
      this.toggleInscriptionId();
      this.reconcile();
    });
  }

  private reconcile(): void {
    const inscriptionId = this.toggleInscriptionId();
    if (!this.isIntersecting || !inscriptionId) {
      if (this.appliedId !== '__placeholder__') {
        this.appliedId = '__placeholder__';
        this.currentFetch = null;
        this.element.nativeElement.srcdoc = placeholderAsString;
      }
      return;
    }
    if (this.appliedId === inscriptionId) return;
    this.applyFetchedSrcdoc(inscriptionId);
  }

  private applyFetchedSrcdoc(inscriptionId: string): void {
    // Only show the placeholder if we don't already have the correct body up.
    // Cache-hit re-intersections skip the placeholder flash entirely.
    if (this.appliedId !== inscriptionId && this.appliedId !== '__placeholder__') {
      this.element.nativeElement.srcdoc = placeholderAsString;
      this.appliedId = '__placeholder__';
    }
    const fetchPromise = fetchCubeSrcdoc(inscriptionId).then((srcdoc) => {
      if (this.currentFetch !== fetchPromise) return;
      if (this.toggleInscriptionId() !== inscriptionId) return;
      if (!this.isIntersecting) return;
      this.element.nativeElement.srcdoc = srcdoc;
      this.appliedId = inscriptionId;
    }).catch(() => {
      // Placeholder stays visible on failure.
    });
    this.currentFetch = fetchPromise;
  }
}
