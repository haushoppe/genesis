import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

const ORD_PROXY_INSCRIPTION = 'https://ord.ordpool.space/inscription';

interface OrdInscriptionResponse {
  id?: string;
}

/**
 * Resolve a `#12345`-style inscription number to its full
 * `txid+i+index` id via our ord-proxy. Returns null on any
 * error/not-found so the caller can no-op silently.
 */
@Injectable({ providedIn: 'root' })
export class InscriptionLookupService {
  private readonly http = inject(HttpClient);

  lookupById(inscriptionNumber: string): Observable<string | null> {
    return this.http
      .get<OrdInscriptionResponse>(`${ORD_PROXY_INSCRIPTION}/${inscriptionNumber}`, {
        headers: { Accept: 'application/json' },
      })
      .pipe(
        map((body) => body?.id ?? null),
        catchError(() => of(null)),
      );
  }
}
