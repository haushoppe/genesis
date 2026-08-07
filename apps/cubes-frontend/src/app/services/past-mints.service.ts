import { computed, effect, inject, Injectable, Signal, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { WalletService } from 'ordpool-sdk';
import { catchError, of } from 'rxjs';

import { CubesDataService } from './cubes-data/cubes-data.service';
import { InscriptionExtended } from './cubes-data/types';
import { getLocalStore, setLocalStore } from './local-storage';

const STORAGE_KEY = 'cube_past';

export interface PastMint {
  commitTxId: string;
  revealTxId: string;
  createdAt: string;
  /** Ordinals-recipient address of the mint. Filters fromLocal to
   *  the currently-connected wallet; empty string on pre-fix entries
   *  (treated as wildcard for backward compat). */
  ordinalsAddress: string;
  /** Six inscription IDs the user picked for this cube. Read by
   *  CubeSuggestionService to bar just-minted IDs from re-suggestion
   *  before ord + the hourly index catch up (~70 min lag). */
  inscriptionIds: string[];
}

/**
 * Unified item shape rendered by "My cubes". Two sources merged:
 *
 * - `index`: the cube already appears in the public cubes.json index
 *   and its firstOwner matches the connected wallet.
 * - `local`: the cube was minted this session (or by this browser in
 *   the past) and either isn't in the index yet OR is in the index
 *   with firstOwner still null (esplora backfill pending).
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
      ordinalsAddress: typeof m.ordinalsAddress === 'string' ? m.ordinalsAddress : '',
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
 * User's cube history.
 *
 * - `pastMints`: volatile per-browser buffer of just-minted cubes,
 *   persisted to localStorage under `cube_past`. Populated by
 *   `record(...)` after a successful mint.
 * - `myCubes`: derived signal — index cubes owned by the connected
 *   wallet, unioned with local entries not yet resolved in the index.
 *   Local entries self-purge as soon as the index has a non-null
 *   firstOwner for them, keeping localStorage small.
 */
@Injectable({ providedIn: 'root' })
export class PastMintsService {
  readonly pastMints = signal<PastMint[]>(readInitial());

  private readonly walletService = inject(WalletService);
  private readonly cubesData = inject(CubesDataService);

  private readonly wallet = toSignal(this.walletService.connectedWallet$, { initialValue: null });
  private readonly allCubes: Signal<InscriptionExtended[]> = toSignal(
    // catchError → toSignal never re-throws on read even if the
    // shared HTTP request failed. UI reads the empty array and
    // renders "no cubes"; a manual reload via any rxResourceFixed
    // consumer re-fetches (resetOnError on the shareReplay).
    this.cubesData.getAllCubes().pipe(catchError(() => of([] as InscriptionExtended[]))),
    { initialValue: [] as InscriptionExtended[] },
  );

  /** Reveal-txids in the index WITH a resolved firstOwner. Local
   *  entries only self-purge once their reveal shows up here — if
   *  the index has the cube but firstOwner is still null (esplora
   *  backfill pending), we keep the local entry visible so the cube
   *  never disappears mid-flight. */
  private readonly resolvedIndexRevealTxids = computed<Set<string>>(
    () => new Set(
      this.allCubes()
        .filter((c) => c.firstOwner !== null && c.firstOwner !== undefined)
        .map((c) => revealTxidFromInscriptionId(c.inscriptionId)),
    ),
  );

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

    const resolved = this.resolvedIndexRevealTxids();
    const fromLocal: MyCube[] = this.pastMints()
      .filter((m) => {
        if (!m.revealTxId) return false;
        if (resolved.has(m.revealTxId.toLowerCase())) return false;
        // Wallet scoping: empty ordinalsAddress = pre-fix entry,
        // treat as wildcard for backward compat.
        const mAddr = normalizeAddr(m.ordinalsAddress);
        return !mAddr || mAddr === addr;
      })
      .map((m) => ({
        source: 'local',
        revealTxId: m.revealTxId,
        commitTxId: m.commitTxId,
        createdAt: m.createdAt,
      }));

    return [...fromLocal, ...fromIndex];
  });

  constructor() {
    // Persist pastMints → localStorage. Skip first tick (rehydrate echo).
    let firstRun = true;
    effect(() => {
      const list = this.pastMints();
      if (firstRun) {
        firstRun = false;
        return;
      }
      setLocalStore(STORAGE_KEY, JSON.stringify(list));
    });

    // Self-cleanup: drop localStorage entries once the index has a
    // resolved firstOwner for them. Waits for firstOwner!=null so a
    // still-backfilling index entry doesn't make the cube vanish.
    effect(() => {
      const resolved = this.resolvedIndexRevealTxids();
      if (resolved.size === 0) return;
      const current = untracked(() => this.pastMints());
      const filtered = current.filter((m) => m.revealTxId && !resolved.has(m.revealTxId.toLowerCase()));
      if (filtered.length !== current.length) {
        this.pastMints.set(filtered);
      }
    });
  }

  record(commitTxId: string, revealTxId: string, inscriptionIds: string[] = []): void {
    const ordinalsAddress = normalizeAddr(untracked(() => this.wallet())?.ordinalsAddress);
    this.pastMints.update((list) => [
      { commitTxId, revealTxId, createdAt: new Date().toISOString(), ordinalsAddress, inscriptionIds },
      ...list,
    ]);
  }
}
