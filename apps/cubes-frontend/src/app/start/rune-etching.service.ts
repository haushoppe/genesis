import { Injectable, signal } from '@angular/core';
import { resolveRuneEtchingTxid } from 'ordpool-sdk';

import { environment } from '../../environments/environment';

/**
 * Rune name to the transaction that etched it, for the funding-safety panel.
 *
 * The scan names the runes on a coin but carries no txid, so each name is
 * looked up once against ord and remembered. The answers are a signal, so the
 * rows re-render as they arrive: a name is plain text until its own lookup
 * answers, and one slow name never holds up a panel someone is reading to
 * decide whether to spend a coin.
 *
 * Only a POSITIVE answer is cached. A name resolves to the same etching
 * forever, so remembering one is free, but remembering a `null` would turn a
 * single ord hiccup into a row that stays unlinked for the life of the app.
 * The in-flight set is what stops a re-render from asking again meanwhile.
 */
@Injectable({ providedIn: 'root' })
export class RuneEtchingService {
  /** Resolved names only. Read by the panel through {@link etchings}. */
  private readonly resolved = signal<ReadonlyMap<string, string>>(new Map());

  /** Names with a lookup in flight, so a re-render does not start a second. */
  private readonly inFlight = new Set<string>();

  readonly etchings = this.resolved.asReadonly();

  /**
   * Look up every name not already known or in flight. Runs them together,
   * because a coin can carry several and they do not depend on each other.
   */
  resolve(names: readonly string[]): void {
    const wanted = names.filter((n) => !this.resolved().has(n) && !this.inFlight.has(n));
    if (wanted.length === 0) return;

    for (const name of wanted) this.inFlight.add(name);

    void Promise.all(
      wanted.map(async (name) => {
        // Never throws: the SDK returns null for a 404, a timeout or a rune
        // with no etching transaction, which all render the same way.
        const txid = await resolveRuneEtchingTxid(name, { ordBaseUrl: environment.ordApiUrl });
        this.inFlight.delete(name);
        if (txid === null) return;
        const next = new Map(this.resolved());
        next.set(name, txid);
        this.resolved.set(next);
      }),
    );
  }
}
