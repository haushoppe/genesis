import { Directive, ElementRef, effect, inject, input, DestroyRef } from '@angular/core';

import { environment } from '../../environments/environment';
import { DARK_PLACEHOLDER_SRCDOC, fetchCubeSrcdoc } from '../shared/utils/cube-srcdoc';

// ord's own render endpoint. Prod: https://ordinals.com/preview/ ; regtest:
// the local ord. The cube's bytes are fetched from the sibling /content/ of
// this base and shown as srcdoc, so the canvas is dark from its first frame.
/**
 * How long to wait before asking again for a cube whose fetch failed, and how
 * many times. Sized for the one failure that actually happens: the content
 * host answers 404 for a few seconds between a reveal being broadcast and its
 * witness being indexed, so a handful of attempts a second apart covers it
 * without turning a genuinely missing cube into a permanent poll.
 */
const FETCH_RETRY_MS = 1_000;
const MAX_FETCH_RETRIES = 8;

const PREVIEW_BASE = environment.ordinalsExplorerIframe;

/**
 * Lazy-render an on-chain inscription (a cube, or any inscription) when it
 * scrolls into view, and unload it when it leaves, so a grid of cubes does
 * not keep every WebGL scene alive on a phone.
 *
 * In view: the iframe first shows the dark placeholder, then the cube's
 * fetched bytes as `srcdoc`, wrapped with a dark colour-scheme meta (see
 * `cube-srcdoc.ts` for why a cross-origin `src` would paint white until the
 * scene renders). Out of view: back to the dark placeholder. Every swap is
 * dark ↔ dark. Re-fetches on `toggleInscriptionId` change so a reused iframe
 * (details prev/next) shows the new cube.
 *
 * Every document after the first is shown in a FRESH iframe element that
 * replaces the current one, never by re-navigating the element in place.
 * Chrome does not paint a new srcdoc document in an iframe whose current
 * document still runs a WebGL scene (the details page after prev/next or the
 * arrow keys stayed a flat dark rectangle; a new element with the identical
 * srcdoc painted at once). A fresh element also guarantees the old scene is
 * torn down.
 *
 * This is the measured, final mechanism for the white-flash problem; see
 * CLAUDE.md "HARD RULE: Cube iframes render via srcdoc + dark canvas" before
 * changing how the iframe is loaded, unloaded or made visible.
 */
@Directive({
  selector: '[appToggleIframe]',
  standalone: true,
})
export class ToggleIframeDirective {

  readonly toggleInscriptionId = input('');

  /** Preview base whose ord serves the cube. Defaults to the public confirmed
   *  explorer (ordinals.com). The mint success panel + "My cubes" pass the
   *  witness-capable base (ordpool-backend) so a still-unconfirmed cube
   *  renders from the mempool. Must end with `/preview/`. */
  readonly previewBase = input<string>('');

  private readonly element = inject<ElementRef<HTMLIFrameElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private intersectionObserver: IntersectionObserver | undefined;
  private isIntersecting = false;
  /** The iframe element currently in the DOM: Angular's host at first, then
   *  the fresh element of the latest document swap. */
  private current: HTMLIFrameElement;
  /** The id currently applied (or being fetched); '' while showing the placeholder. */
  private appliedId = '';
  /** The fetch whose result may still be applied; a stale one must not overwrite. */
  private currentFetch: Promise<string> | null = null;
  /** Failed fetches for the current id, so a permanently missing cube stops asking. */
  private retries = 0;
  /** The id the retry budget belongs to; a different cube starts fresh. */
  private lastAttemptedId = '';
  /** Pending retry, cancelled on destroy so it cannot fire into a dead view. */
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const host = this.element.nativeElement;
    this.current = host;
    host.srcdoc = DARK_PLACEHOLDER_SRCDOC;

    this.intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        this.isIntersecting = entry.isIntersecting;
        this.reconcile();
      }
    });
    this.intersectionObserver.observe(host);
    this.destroyRef.onDestroy(() => {
      this.intersectionObserver?.disconnect();
      clearTimeout(this.retryTimer);
      // Angular removes its own host; a replacement element is ours to remove.
      if (this.current !== host) this.current.remove();
    });

    // Re-point when the input signal changes while the iframe stays visible.
    effect(() => {
      this.toggleInscriptionId();
      this.previewBase();
      this.reconcile();
    });
  }

  private reconcile(): void {
    const inscriptionId = this.toggleInscriptionId();
    if (!this.isIntersecting || !inscriptionId) {
      if (this.appliedId !== '') {
        this.appliedId = '';
        this.currentFetch = null;
        clearTimeout(this.retryTimer);
        this.retryTimer = undefined;
        this.retries = 0;
        this.show(DARK_PLACEHOLDER_SRCDOC);
      }
      return;
    }
    if (this.appliedId === inscriptionId) return;
    // A different cube gets its own budget; the count belongs to the id, not
    // to the directive's lifetime.
    if (this.lastAttemptedId !== inscriptionId) {
      this.lastAttemptedId = inscriptionId;
      this.retries = 0;
    }
    this.appliedId = inscriptionId;
    // Placeholder first, so the tile is never blank while the fetch is in flight.
    this.show(DARK_PLACEHOLDER_SRCDOC);
    const thisFetch = fetchCubeSrcdoc(inscriptionId, this.previewBase() || PREVIEW_BASE);
    this.currentFetch = thisFetch;
    thisFetch
      .then((srcdoc) => {
        // A newer id, or a scroll-out, superseded this fetch: leave it be.
        if (this.currentFetch !== thisFetch) return;
        this.show(srcdoc);
      })
      .catch(() => {
        if (this.currentFetch !== thisFetch) return;
        // Release the id so the work can be done again.
        this.appliedId = '';
        // And actually do it again, on a short delay. Releasing alone only
        // helps a tile that can be scrolled out and back in; `reconcile` is
        // reached from the intersection observer and the id input, and neither
        // fires again for a frame that never leaves the viewport and never
        // changes id. The mint-success preview is exactly that, and its fetch
        // is the one most likely to fail: the content host 404s in the beat
        // between the transaction being visible and its witness being indexed.
        // Without a retry the reader watches an empty dark rectangle where the
        // cube they just paid for should be, for as long as they look at it.
        if (this.retries >= MAX_FETCH_RETRIES) return;
        this.retries += 1;
        this.retryTimer = setTimeout(() => {
          this.retryTimer = undefined;
          if (this.currentFetch === thisFetch) this.reconcile();
        }, FETCH_RETRY_MS);
      });
  }

  /**
   * Shows `srcdoc` in a fresh iframe element (same attributes) that replaces
   * the current one. The very first document, set before the host is in the
   * DOM, stays in place; so does a swap to the document already shown.
   */
  private show(srcdoc: string): void {
    const old = this.current;
    if (old.srcdoc === srcdoc) return;
    if (!old.isConnected) {
      old.srcdoc = srcdoc;
      return;
    }
    const fresh = old.cloneNode(false) as HTMLIFrameElement;
    fresh.srcdoc = srcdoc;
    old.replaceWith(fresh);
    this.intersectionObserver?.unobserve(old);
    this.intersectionObserver?.observe(fresh);
    this.current = fresh;
  }
}
