import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { environment } from '../../environments/environment';

interface PriceResponse {
  time?: number;
  USD?: number;
  EUR?: number;
}

/**
 * Cheap `sat → USD` conversion for the mint cost readout.
 *
 * Hits `<mempoolApiUrl>/api/v1/prices` (mempool-fork endpoint, served
 * by our ordpool-backend at api.ordpool.space). Regtest env has an
 * empty `mempoolApiUrl` — we return null so the UI hides the USD
 * suffix silently. Any network / parse error falls back the same way.
 */
@Injectable({ providedIn: 'root' })
export class PriceService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.mempoolApiUrl;

  getBtcUsd(): Observable<number | null> {
    if (!this.base) return of(null);
    return this.http.get<PriceResponse>(`${this.base}/api/v1/prices`).pipe(
      // Upstream (ordpool-backend price-updater) seeds `USD: -1` on
      // cold start and can transiently return 0 / non-number values
      // when a fetch fails. Treat anything that isn't a positive
      // finite number as "no price".
      map((p) => {
        const v = p?.USD;
        return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
      }),
      catchError(() => of(null)),
    );
  }
}
