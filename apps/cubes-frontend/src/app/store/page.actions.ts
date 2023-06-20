import { createActionGroup, emptyProps } from '@ngrx/store';

// This action indicates that the main data has been loaded and we are allowed to scroll!
export const PageActions = createActionGroup({
  source: 'Page',
  events: {
    'Ready': emptyProps()
  }
});
