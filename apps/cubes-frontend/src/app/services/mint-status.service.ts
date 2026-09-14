import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { catchError, of } from 'rxjs';

import { environment } from '../../environments/environment';

/**
 * Confirmation state of a just-broadcast mint, from the reveal txid.
 *
 * - `unknown`: not yet visible in the mempool (broadcast in flight, or the
 *   esplora index hasn't caught the tx). The cube isn't renderable yet.
 * - `mempool`: the tx is in the mempool, unconfirmed. ordpool renders the
 *   cube from its witness at this point, so the preview can show.
 * - `confirmed`: mined; `blockHeight` is set.
 */
export interface MintTxStatus {
  state: 'unknown' | 'mempool' | 'confirmed';
  blockHeight?: number;
}

interface EsploraTxStatus {
  confirmed?: boolean;
  block_height?: number;
}

/**
 * Map an esplora `/tx/:id` response to the next mint status, or `null` when
 * there is nothing to apply (404 / error: the tx isn't in the index yet, so
 * keep whatever status we already showed rather than regressing it).
 */
export function nextMintTxStatus(tx: { status?: EsploraTxStatus } | null): MintTxStatus | null {
  if (!tx) return null;
  if (tx.status?.confirmed) return { state: 'confirmed', blockHeight: tx.status.block_height };
  return { state: 'mempool' };
}

const POLL_MS = 5_000;

/**
 * Ceiling for one txid's polling interval.
 *
 * A reveal that is dropped, replaced, or simply priced below the next few
 * blocks never reaches `confirmed`, and the loop has no other way to end. At a
 * flat five seconds that is 720 requests an hour, forever, against a host we
 * run, for every stale entry in a reader's local history. Backing off keeps the
 * answer eventually correct while making the cost of being wrong bounded.
 */
const MAX_POLL_MS = 5 * 60_000;

/** How far along a status is. A poll may advance this, never walk it back. */
const RANK: Record<MintTxStatus['state'], number> = { unknown: 0, mempool: 1, confirmed: 2 };

/** Per-txid polling bookkeeping. */
interface Tracked {
  sig: WritableSignal<MintTxStatus>;
  /** Epoch ms before which this txid is not polled again. */
  dueAt: number;
  /** Consecutive polls that did not reach `confirmed`. Drives the backoff. */
  misses: number;
  /** A request is out; a second would race the first. */
  inFlight: boolean;
}

/**
 * Polls esplora `/api/tx/<txid>` for the reveal tx of each tracked mint and
 * exposes a per-txid status signal. The source of truth for WHICH cubes to
 * track is the caller (localStorage-backed `pastMints`); this service only
 * answers "where is this known txid now". Confirmed txids stop being polled.
 */
@Injectable({ providedIn: 'root' })
export class MintStatusService {
  private readonly http = inject(HttpClient);
  // '' in regtest (relative /api/tx, proxied to electrs); api.ordpool.space in prod.
  private readonly esploraBase = `${environment.mempoolApiUrl}/api`;

  private readonly statuses = new Map<string, Tracked>();
  private timer: ReturnType<typeof setInterval> | undefined;

  /** Signal of the reveal tx's status. Registers it for polling on first use. */
  statusOf(revealTxId: string): Signal<MintTxStatus> {
    const key = revealTxId.toLowerCase();
    const existing = this.statuses.get(key);
    if (existing) return existing.sig;

    const sig = signal<MintTxStatus>({ state: 'unknown' });
    const tracked: Tracked = { sig, dueAt: 0, misses: 0, inFlight: false };
    this.statuses.set(key, tracked);
    this.poll(key, tracked);
    this.ensureTimer();
    return sig;
  }

  private ensureTimer(): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      let anyPending = false;
      for (const [txid, tracked] of this.statuses) {
        if (tracked.sig().state === 'confirmed') continue;
        anyPending = true;
        if (now < tracked.dueAt) continue;
        this.poll(txid, tracked);
      }
      if (!anyPending && this.timer !== undefined) {
        clearInterval(this.timer);
        this.timer = undefined;
      }
    }, POLL_MS);
  }

  private poll(txid: string, tracked: Tracked): void {
    // One request at a time per txid. Two in flight can land out of order, and
    // the later answer is not the newer one.
    if (tracked.inFlight) return;
    tracked.inFlight = true;

    this.http
      .get<{ status?: EsploraTxStatus }>(`${this.esploraBase}/tx/${txid}`)
      .pipe(catchError(() => of(null)))
      .subscribe((tx) => {
        tracked.inFlight = false;
        const next = nextMintTxStatus(tx);

        // Never walk the status back: a confirmed mint must not return to "In
        // the mempool", lose its block height, and restart the loop, because
        // the loop's exit condition reads the state that was just regressed.
        //
        // Defence in depth, and honestly labelled as such: the in-flight guard
        // above already makes two concurrent requests for one txid impossible,
        // so responses cannot cross and this branch is unreachable through the
        // public path. Removing it turns no test red. It stays because it is
        // one comparison and it is what keeps the regression from coming back
        // if the in-flight guard is ever loosened.
        if (next && RANK[next.state] > RANK[tracked.sig().state]) {
          tracked.sig.set(next);
        }

        if (tracked.sig().state === 'confirmed') return;

        // Back off while the answer keeps not being "confirmed", so a reveal
        // that never confirms costs a request every few minutes rather than
        // every five seconds for the life of the tab.
        tracked.misses += 1;
        const delay = Math.min(POLL_MS * 2 ** Math.floor(tracked.misses / 3), MAX_POLL_MS);
        tracked.dueAt = Date.now() + delay;
      });
  }
}
