import { createSelector } from '@ngrx/store';
import * as mintFeature from './mint.reducer';

// test to create other selectors
export const selectTest = createSelector(
  mintFeature.selectAllMints,
  mintFeature.selectAllMintsStatus,
  (mints, status) => ({ mints, status })
);
