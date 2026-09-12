import { ViewportScroller } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Router, Scroll } from '@angular/router';
import { filter, map } from 'rxjs/operators';

/** How long a held position is re-asserted while the new content renders. */
const HOLD_MS = 1500;

/**
 * Router scroll behaviour for cubes-frontend, and the only place that scrolls
 * on navigation (`app.config.ts` hands the job over by switching the router's
 * own `withInMemoryScrolling` off). Four cases:
 *
 * - **Back / forward**: restore the position the router stored, so returning
 *   from a cube's page lands on the same row of the grid.
 * - **An anchor**: scroll it into view, polling briefly because a data-driven
 *   view may render after the `Scroll` event fires.
 * - **A navigation that stays in the same component**: hold the viewport where
 *   it is. The minted-cubes list carries its order and page in the query
 *   string, so picking a sort or a page is a navigation, and scrolling to the
 *   top would throw the reader out of the list they are reading. The position
 *   is re-asserted for a moment because the grid swaps all of its tiles at
 *   once, and while the new ones have no height the document is short enough
 *   for the browser to clamp the scroll position to the top.
 * - **A navigation to another component**: jump to the top, as a page change
 *   should.
 *
 * `anchor === 'x'` stays the caller's way of saying "do not scroll at all".
 */
@Injectable({
  providedIn: 'root',
})
export class CustomScrollService {
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);

  private previousComponent: unknown = undefined;

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
          const current = this.activeComponent();
          const changed = this.previousComponent !== undefined && current !== this.previousComponent;
          this.previousComponent = current;
          if (changed) {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' } as ScrollToOptions);
          } else {
            this.holdPosition();
          }
          return;
        }
        this.previousComponent = this.activeComponent();

        // Poll a few times for late-arriving anchors (data-driven views
        // may render after the Scroll event fires). Position-based
        // restores don't need polling and land on the first tick.
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
        tryScroll();
      });
  }

  /** The component of the deepest active route. */
  private activeComponent(): unknown {
    let route = this.router.routerState.root;
    while (route.firstChild) route = route.firstChild;
    return route.component;
  }

  /** Keeps the viewport where it is while the view re-renders under it. */
  private holdPosition(): void {
    const position = this.viewportScroller.getScrollPosition();
    if (position[1] === 0) return;
    const deadline = Date.now() + HOLD_MS;
    const hold = () => {
      this.viewportScroller.scrollToPosition(position);
      if (Date.now() < deadline) setTimeout(hold, 100);
    };
    hold();
  }
}
