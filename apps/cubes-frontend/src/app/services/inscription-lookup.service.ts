import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { cat21Config } from 'ordpool-sdk';
import { catchError, map, Observable, of } from 'rxjs';

interface OrdInscriptionResponse {
  id?: string;
}

/**
 * Resolve a `#12345`-style inscription number to its full
 * `txid+i+index` id via our ord-proxy. Returns null on any
 * error/not-found so the caller can no-op silently.
 *
 * Reuses `cat21Config.ordApiUrl` from DI so testnet / local ord
 * overrides land in one place.
 */
@Injectable({ providedIn: 'root' })
export class InscriptionLookupService {
  private readonly http = inject(HttpClient);
  private readonly ordApiUrl = inject(cat21Config).ordApiUrl;

  lookupById(inscriptionNumber: string): Observable<string | null> {
    return this.http
      .get<OrdInscriptionResponse>(`${this.ordApiUrl}/inscription/${inscriptionNumber}`, {
        headers: { Accept: 'application/json' },
      })
      .pipe(
        map((body) => body?.id ?? null),
        catchError(() => of(null)),
      );
  }
}
