import { computed, effect, inject, Injectable, Signal, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { WalletService } from 'ordpool-sdk';

import { CubesDataService } from './cubes-data/cubes-data.service';
import { InscriptionExtended } from './cubes-data/types';
import { getLocalStore, setLocalStore } from './local-storage';

const STORAGE_KEY = 'cube_past';

export interface PastMint {
  commitTxId: string;
  revealTxId: string;
  createdAt: string;
  /**
   * Six inscription IDs the user picked for this cube. Populated for
   * new mints; empty when rehydrated from a pre-2026-07 payload that
   * predates this field. Read by CubeSuggestionService to bar
   * just-minted IDs from re-suggestion before ord+the hourly index
   * catch up (~70 min lag).
   */
  inscriptionIds: string[];
}

/**
 * Unified item shape rendered by "My cubes". Two sources merged:
 *
 * - `index`: the cube already appears in the public cubes.json index
 *   because it was minted by the currently-connected wallet. Rich
 *   metadata (inscription number, block height) is available.
 * - `local`: the cube was minted this session (or by this browser in
 *   the past) and hasn't landed in the hourly index yet. Only txids
 *   are available. Self-purges once the index catches up.
 */
export type MyCube =
  | {
      source: 'index';
      inscriptionId: string;
      inscriptionNumber: number;
      blockHeight: number;
      revealTxId: string;
      firstOwner: string | null;
    }
  | {
      source: 'local';
      revealTxId: string;
      commitTxId: string;
      createdAt: string;
    };

function readInitial(): PastMint[] {
  try {
    const raw = getLocalStore(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m: Partial<PastMint>) => ({
      commitTxId: m.commitTxId ?? '',
      revealTxId: m.revealTxId ?? '',
      createdAt: m.createdAt ?? '',
      inscriptionIds: Array.isArray(m.inscriptionIds) ? m.inscriptionIds : [],
    }));
  } catch {
    return [];
  }
}

function normalizeAddr(addr: string | null | undefined): string {
  return typeof addr === 'string' ? addr.trim().toLowerCase() : '';
}

function revealTxidFromInscriptionId(inscriptionId: string): string {
  const m = inscriptionId.match(/^([0-9a-f]{64})i\d+$/i);
  return m ? m[1].toLowerCase() : '';
}

/**
 * User's cube history. Two roles:
 *
 * 1. Volatile buffer for just-minted cubes not yet in the hourly
 *    `ordinal-cubes-index` (localStorage under `cube_past`). Populated
 *    by `record(...)` after a successful mint.
 * 2. Composed with the currently-connected wallet's ordinals address
 *    and the public index to derive `myCubes` — the durable per-
 *    wallet history. localStorage entries self-purge as soon as their
 *    reveal txid appears in the index, so localStorage stays small.
 *
 * Consumers should read `myCubes` for display and call `record` after
 * a successful mint. `pastMints` is exposed but only for tests /
 * internal wiring — components should not depend on it directly.
 */
@Injectable({ providedIn: 'root' })
export class PastMintsService {
  readonly pastMints = signal<PastMint[]>(readInitial());

  private readonly walletService = inject(WalletService);
  private readonly cubesData = inject(CubesDataService);

  private readonly wallet = toSignal(this.walletService.connectedWallet$, { initialValue: null });
  private readonly allCubes: Signal<InscriptionExtended[]> = toSignal(
    this.cubesData.getAllCubes(),
    { initialValue: [] as InscriptionExtended[] },
  );

  /** Set of reveal-txids present in the public cubes.json index.
   *  Shared by `myCubes` (dedupes local overlay) and the self-cleanup
   *  effect (prunes localStorage entries once landed in the index). */
  private readonly indexRevealTxids = computed<Set<string>>(
    () => new Set(this.allCubes().map((c) => revealTxidFromInscriptionId(c.inscriptionId))),
  );

  /**
   * Every cube attributable to the currently-connected wallet's
   * ordinals address, unioned with just-minted-but-not-yet-indexed
   * entries from localStorage. Empty when no wallet is connected.
   */
  readonly myCubes: Signal<MyCube[]> = computed<MyCube[]>(() => {
    const addr = normalizeAddr(this.wallet()?.ordinalsAddress);
    if (!addr) return [];

    const fromIndex: MyCube[] = this.allCubes()
      .filter((c) => normalizeAddr(c.firstOwner) === addr)
      .map((c) => ({
        source: 'index',
        inscriptionId: c.inscriptionId,
        inscriptionNumber: c.inscriptionNumber,
        blockHeight: c.blockHeight,
        revealTxId: revealTxidFromInscriptionId(c.inscriptionId),
        firstOwner: c.firstOwner ?? null,
      }));

    // Pending: localStorage entries whose revealTxid isn't in the
    // index yet. These are the just-minted cubes waiting for the
    // hourly grind to catch up.
    const known = this.indexRevealTxids();
    const fromLocal: MyCube[] = this.pastMints()
      .filter((m) => m.revealTxId && !known.has(m.revealTxId.toLowerCase()))
      .map((m) => ({
        source: 'local',
        revealTxId: m.revealTxId,
        commitTxId: m.commitTxId,
        createdAt: m.createdAt,
      }));

    // Local first (newest / pending on top), then index-derived.
    return [...fromLocal, ...fromIndex];
  });

  constructor() {
    // Persist pastMints signal → localStorage. Skip first tick (echo).
    let firstRun = true;
    effect(() => {
      const list = this.pastMints();
      if (firstRun) {
        firstRun = false;
        return;
      }
      setLocalStore(STORAGE_KEY, JSON.stringify(list));
    });

    // Self-cleanup: whenever the index changes, drop any localStorage
    // entries whose revealTxid has landed in it. Keeps the volatile
    // buffer small and prevents duplicate rows in myCubes. Guarded
    // no-op when nothing needs pruning so the pastMints signal
    // doesn't emit spuriously.
    effect(() => {
      const known = this.indexRevealTxids();
      if (known.size === 0) return;
      const current = untracked(() => this.pastMints());
      const filtered = current.filter((m) => m.revealTxId && !known.has(m.revealTxId.toLowerCase()));
      if (filtered.length !== current.length) {
        this.pastMints.set(filtered);
      }
    });
  }

  record(commitTxId: string, revealTxId: string, inscriptionIds: string[] = []): void {
    this.pastMints.update((list) => [
      { commitTxId, revealTxId, createdAt: new Date().toISOString(), inscriptionIds },
      ...list,
    ]);
  }
}
