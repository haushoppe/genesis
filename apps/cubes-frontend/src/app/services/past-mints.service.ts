import { effect, Injectable, signal } from '@angular/core';

import { getLocalStore, setLocalStore } from './local-storage';

const STORAGE_KEY = 'cube_past';

export interface PastMint {
  commitTxId: string;
  revealTxId: string;
  createdAt: string;
}

function readInitial(): PastMint[] {
  try {
    const raw = getLocalStore(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PastMint[] : [];
  } catch {
    return [];
  }
}

/**
 * Persistent list of the user's past cube mints (commit + reveal
 * txids). Replaces the retired NgRx `past` slice + `ngrx-store-
 * localstorage` metaReducer. Signal state, plain effect writes to
 * localStorage under the same `cube_past` key.
 */
@Injectable({ providedIn: 'root' })
export class PastMintsService {
  readonly pastMints = signal<PastMint[]>(readInitial());

  constructor() {
    // Skip the first tick — it would just echo back what readInitial()
    // already returned. Subsequent changes get persisted.
    let firstRun = true;
    effect(() => {
      const list = this.pastMints();
      if (firstRun) {
        firstRun = false;
        return;
      }
      setLocalStore(STORAGE_KEY, JSON.stringify(list));
    });
  }

  record(commitTxId: string, revealTxId: string): void {
    this.pastMints.update((list) => [
      { commitTxId, revealTxId, createdAt: new Date().toISOString() },
      ...list,
    ]);
  }
}
