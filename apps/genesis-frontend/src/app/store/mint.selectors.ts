import { createSelector } from '@ngrx/store';
import * as mintFeature from './mint.reducer';

// test to create other selectors
export const selectTest = createSelector(
  mintFeature.selectMints,
  mintFeature.selectMintsStatus,
  (mints, status) => ({ mints, status })
);
