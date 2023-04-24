import { ViewportScroller } from '@angular/common';
import { Injectable } from '@angular/core';
import { Router, Scroll } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { filter, map, take } from 'rxjs/operators';

import { PageActions } from './store/page.actions';

@Injectable({
  providedIn: 'root',
})
export class CustomScrollService {

  constructor(router: Router, viewportScroller: ViewportScroller, actions: Actions) {

    router.events
      .pipe(
        filter((event) => event instanceof Scroll),
        map(e => e as Scroll) // fixing type
      ).subscribe((e) => {

        // directly jump to top, no waiting required
        if (e.position == null) {
          // console.log('Jumping to top!')
          window.scrollTo({ top: 0, left:0, behavior: "instant"} as unknown as ScrollToOptions)
          return;
        }

        actions.pipe(
          ofType(PageActions.ready),
          take(1)
        ).subscribe(() => {

          // console.log('Page loaded!')

          if (e.anchor) {
            viewportScroller.scrollToAnchor(e.anchor);
          } else if (e.position) {
            viewportScroller.scrollToPosition(e.position);
          }
        });
      });
  }

}
