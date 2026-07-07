import { createFeature, createReducer, on } from '@ngrx/store';

import { MintActions } from './mint.actions';


/**
 * Persisted, localStorage-backed history of past mints so users can
 * see what they've inscribed across sessions. Each entry pairs the
 * two txids that make up an inscribe (commit + reveal) with the
 * moment the user broadcast it.
 */
export interface State {
  pastMints: { commitTxId: string, revealTxId: string, createdAt: string }[];
}

export const initialState: State = {
  pastMints: [],
};


export const pastFeature = createFeature({
  name: 'past',
  reducer: createReducer(
    initialState,

    on(MintActions.recordPastMint, (state, { commitTxId, revealTxId, createdAt }) => ({
      ...state,
      pastMints: [
        ...state.pastMints,
        { commitTxId, revealTxId, createdAt },
      ],
    })),
  )
});

export const {
  name,
  reducer,
  selectPastState,
  selectPastMints,
} = pastFeature;
