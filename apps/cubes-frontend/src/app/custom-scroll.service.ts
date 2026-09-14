import { ViewportScroller } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Router, Scroll } from '@angular/router';
import { filter, map } from 'rxjs/operators';

/** How long a held position is re-asserted while the new content renders. */
const HOLD_MS = 1500;

/**
 * Inputs that mean the reader wants to scroll. A hold releases on the first
 * one, because only an input distinguishes their intent from the layout
 * shifting underneath them.
 */
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown'] as const;

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

  /** Timer of a hold in flight, so the next navigation can cancel it. */
  private holdTimer: ReturnType<typeof setTimeout> | null = null;

  /** Removes the hold's input listeners. Null when no hold is in flight. */
  private releaseHold: (() => void) | null = null;

  constructor() {
    // Take the browser's own scroll restoration off the field.
    //
    // Angular normally does this, but it is gated on exactly the option
    // `app.config.ts` switches off: RouterScroller.init() only calls
    // setHistoryScrollRestoration('manual') when scrollPositionRestoration is
    // NOT 'disabled'. So turning the router's restoration off left
    // history.scrollRestoration at 'auto' (measured on production), and on
    // back/forward the browser restored an offset on its own schedule against
    // a grid that had not rendered yet, while this service restored another.
    // Two things scrolling, neither aware of the other.
    this.viewportScroller.setHistoryScrollRestoration('manual');

    this.router.events
      .pipe(
        filter((event) => event instanceof Scroll),
        map((e) => e as Scroll),
      )
      .subscribe((e) => {
        // Any hold belongs to the navigation that started it.
        this.cancelHold();

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
          // getElementById, not querySelector('#' + anchor): a fragment is an
          // arbitrary string and most are not valid CSS identifiers. `#1`
          // throws a SyntaxError, which escapes this callback, kills the
          // subscription and takes the position fallback down with it.
          if (e.anchor && document.getElementById(e.anchor)) {
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

  /**
   * Keeps the viewport where it is while the view re-renders under it.
   *
   * The grid swaps every tile at once, so for a moment the document is a
   * different height and the browser moves the scroll position on its own. The
   * position is therefore re-asserted for a while rather than set once.
   *
   * It stops early on the reader's first scroll input. The test is the INPUT,
   * not the resulting offset: a layout shift moves the offset too, so
   * comparing positions cannot tell "the page resized under them" from "they
   * scrolled", and treating the first as the second gives up the hold exactly
   * when it is needed. Measured: clicking page 2 moves the offset by several
   * hundred pixels with nobody touching anything.
   *
   * Cancellable, and cancelled by the next navigation: three quick page clicks
   * used to leave three loops alive with three different captured offsets,
   * alternating every 100 ms, and a hold started on the list could drag a
   * freshly opened cube page back down to the list's offset.
   */
  private holdPosition(): void {
    const position = this.viewportScroller.getScrollPosition();
    if (position[1] === 0) return;
    const deadline = Date.now() + HOLD_MS;

    const release = () => this.cancelHold();
    for (const type of USER_SCROLL_EVENTS) {
      window.addEventListener(type, release, { passive: true });
    }
    this.releaseHold = () => {
      for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, release);
    };

    const hold = () => {
      this.holdTimer = null;
      this.viewportScroller.scrollToPosition(position);
      if (Date.now() < deadline) this.holdTimer = setTimeout(hold, 100);
      else this.cancelHold();
    };
    this.holdTimer = setTimeout(hold, 0);
  }

  /** Stops a hold in flight, so it cannot outlive the navigation that began it. */
  private cancelHold(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    if (this.releaseHold !== null) {
      this.releaseHold();
      this.releaseHold = null;
    }
  }
}
