/* eslint-disable prefer-rest-params */
/* eslint-disable prefer-spread */
/* eslint-disable @typescript-eslint/no-empty-function */

import { createSelectorFactory } from '@ngrx/store';

// see https://github.com/ngrx/platform/commit/d5d287cff90f1110e070e0ee8f224e3e25552e4d
// TODO: testing this ^_^
export const noMemoizedSelector = createSelectorFactory(
  (projectionFunction) => {

    function memoized() {
      return projectionFunction.apply(null, arguments as any);
    }

    return {
      memoized,
      reset: () => { },
      setResult: () => { },
      clearResult: () => { },
    };
  }
);
