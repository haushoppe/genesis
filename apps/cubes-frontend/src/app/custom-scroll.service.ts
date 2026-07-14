import { ViewportScroller } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Router, Scroll } from '@angular/router';
import { filter, map } from 'rxjs/operators';

/**
 * Router scroll behaviour tuned for cubes-frontend. Handles:
 * - navigation without anchor/position → jump to top
 * - navigation to an anchor already in the DOM → scroll immediately
 * - navigation to an anchor not yet rendered → poll briefly, give up
 */
@Injectable({
  providedIn: 'root',
})
export class CustomScrollService {
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof Scroll),
        map((e) => e as Scroll),
      )
      .subscribe((e) => {
        // Special value that means "don't scroll at all".
        if (e.anchor === 'x') return;

        if (!e.position && !e.anchor) {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' } as ScrollToOptions);
          return;
        }

        if (e.anchor && document.querySelector('#' + e.anchor)) {
          this.viewportScroller.scrollToAnchor(e.anchor);
          return;
        }

        // Anchor not in DOM yet — poll a few times, then give up. Keeps
        // the service framework-agnostic; no need for a global ready-
        // event bus.
        const deadline = Date.now() + 1500;
        const tryScroll = () => {
          if (e.anchor && document.querySelector('#' + e.anchor)) {
            this.viewportScroller.scrollToAnchor(e.anchor);
          } else if (e.position) {
            this.viewportScroller.scrollToPosition(e.position);
          } else if (Date.now() < deadline) {
            setTimeout(tryScroll, 100);
          }
        };
        setTimeout(tryScroll, 50);
      });
  }
}
