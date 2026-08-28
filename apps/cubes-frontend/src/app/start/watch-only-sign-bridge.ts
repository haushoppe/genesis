import { catchError, from, map, Observable, throwError } from 'rxjs';

/**
 * Bridges an export/paste modal's result into the SDK's
 * `promptForSignedPsbt` contract used by a watch-only (xpub) inscribe.
 *
 * The caller opens a modal and hands us its `result` promise:
 * - resolved with the user's pasted signed PSBT → emit it, trimmed. The
 *   SDK's watch-only signer accepts base64 or hex, so no format coercion
 *   here; the SDK validates and finalizes.
 * - dismissed (Cancel / backdrop / Esc) → the promise rejects; map that to
 *   a clean, user-facing cancel error instead of leaking the ng-bootstrap
 *   dismissal reason into the mint's error banner.
 */
export function bridgeSignedPsbt(modalResult: Promise<unknown>): Observable<string> {
  return from(modalResult).pipe(
    map((signed) => (typeof signed === 'string' ? signed.trim() : '')),
    catchError(() => throwError(() => new Error('Watch-only signing was cancelled.'))),
  );
}
