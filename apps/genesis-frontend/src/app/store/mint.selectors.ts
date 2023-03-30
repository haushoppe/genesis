import { createSelector } from '@ngrx/store';

import { selectTotalSupply } from './mint.reducer';
import { selectConfig } from './wallet.reducer';

export const selectBestTotalSupply = createSelector(
  selectTotalSupply,
  selectConfig,
  (totalSupply, config) => totalSupply || config?.totalSupply || 0
);
