import { Directive, ElementRef, effect, inject, input, DestroyRef } from '@angular/core';

import { environment } from '../../environments/environment';

// ord's own render endpoint. Prod: https://ordinals.com/preview/ ; regtest:
// the local ord. A cube framed from here loads its renderer + sides from
// the same origin (edge-cached, no redirect), so it paints as fast as it
// does on ordinals.com itself, with no white flash and no rewriting of the
// on-chain bytes.
const PREVIEW_BASE = environment.ordinalsExplorerIframe;

/**
 * Lazy-render an on-chain inscription (a cube, or any inscription) by
 * pointing the iframe straight at `PREVIEW_BASE/<id>` when it scrolls into
 * view, and unloading it (`about:blank`) when it leaves. The iframe is kept
 * transparent until its `load` fires, so the dark page shows through during
 * the brief load instead of a white canvas. Re-fetches on
 * `toggleInscriptionId` change so a reused iframe (details prev/next) shows
 * the new cube.
 */
@Directive({
  selector: '[appToggleIframe]',
  standalone: true,
})
export class ToggleIframeDirective {

  readonly toggleInscriptionId = input('');

  private readonly element = inject<ElementRef<HTMLIFrameElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private intersectionObserver: IntersectionObserver | undefined;
  private isIntersecting = false;
  private appliedId = '';

  constructor() {
    const el = this.element.nativeElement;
    el.style.opacity = '0';
    el.style.transition = 'opacity 150ms ease';
    // Reveal only once a real cube has loaded — never for the about:blank
    // unload (appliedId is cleared before that).
    el.addEventListener('load', () => {
      if (this.appliedId) el.style.opacity = '1';
    });

    this.intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        this.isIntersecting = entry.isIntersecting;
        this.reconcile();
      }
    });
    this.intersectionObserver.observe(el);
    this.destroyRef.onDestroy(() => this.intersectionObserver?.disconnect());

    // Re-point when the input signal changes while the iframe stays visible.
    effect(() => {
      this.toggleInscriptionId();
      this.reconcile();
    });
  }

  private reconcile(): void {
    const el = this.element.nativeElement;
    const inscriptionId = this.toggleInscriptionId();
    if (!this.isIntersecting || !inscriptionId) {
      if (this.appliedId !== '') {
        this.appliedId = '';
        el.style.opacity = '0';
        el.src = 'about:blank';
      }
      return;
    }
    if (this.appliedId === inscriptionId) return;
    this.appliedId = inscriptionId;
    el.style.opacity = '0';
    el.src = `${PREVIEW_BASE}${inscriptionId}`;
  }
}
