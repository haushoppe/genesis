import { effect, Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'cube_past';

export interface PastMint {
  commitTxId: string;
  revealTxId: string;
  createdAt: string;
}

interface PastMintsState {
  pastMints: PastMint[];
}

function readInitial(): PastMint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PastMintsState;
    return Array.isArray(parsed?.pastMints) ? parsed.pastMints : [];
  } catch {
    return [];
  }
}

/**
 * Persistent list of the user's past cube mints (commit + reveal
 * txids). Replaces the retired NgRx `past` slice + `ngrx-store-
 * localstorage` metaReducer. Signal state, plain effect writes to
 * localStorage under the same `cube_past` key the metaReducer used.
 */
@Injectable({ providedIn: 'root' })
export class PastMintsService {
  readonly pastMints = signal<PastMint[]>(readInitial());

  constructor() {
    effect(() => {
      const state: PastMintsState = { pastMints: this.pastMints() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage full or blocked (Safari private mode) — swallow.
      }
    });
  }

  record(commitTxId: string, revealTxId: string): void {
    this.pastMints.update((list) => [
      { commitTxId, revealTxId, createdAt: new Date().toISOString() },
      ...list,
    ]);
  }
}
