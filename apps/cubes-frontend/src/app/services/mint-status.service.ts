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

  private readonly statuses = new Map<string, WritableSignal<MintTxStatus>>();
  private timer: ReturnType<typeof setInterval> | undefined;

  /** Signal of the reveal tx's status. Registers it for polling on first use. */
  statusOf(revealTxId: string): Signal<MintTxStatus> {
    const key = revealTxId.toLowerCase();
    let sig = this.statuses.get(key);
    if (!sig) {
      sig = signal<MintTxStatus>({ state: 'unknown' });
      this.statuses.set(key, sig);
      this.poll(key, sig);
      this.ensureTimer();
    }
    return sig;
  }

  private ensureTimer(): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      let anyPending = false;
      for (const [txid, sig] of this.statuses) {
        if (sig().state === 'confirmed') continue;
        anyPending = true;
        this.poll(txid, sig);
      }
      if (!anyPending && this.timer !== undefined) {
        clearInterval(this.timer);
        this.timer = undefined;
      }
    }, POLL_MS);
  }

  private poll(txid: string, sig: WritableSignal<MintTxStatus>): void {
    this.http
      .get<{ status?: EsploraTxStatus }>(`${this.esploraBase}/tx/${txid}`)
      .pipe(catchError(() => of(null)))
      .subscribe((tx) => {
        const next = nextMintTxStatus(tx);
        if (next) sig.set(next);
      });
  }
}
