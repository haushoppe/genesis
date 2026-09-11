import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { probeSideImages, SideImageVerdict } from './side-image-check';

/**
 * Injectable front for `probeSideImages`, so a spec can replace the
 * browser round trip with a stub. Probes against
 * `environment.sideImageProbeBase`, the host the cubes index probes too
 * (`api.ordpool.space` on mainnet, and also under regtest, where the sides
 * are mainnet inscriptions), so the mint form and the score agree on what
 * renders.
 */
@Injectable({ providedIn: 'root' })
export class SideImageProbeService {
  probe(ids: readonly string[]): Observable<Record<string, SideImageVerdict>> {
    return from(probeSideImages(ids, environment.sideImageProbeBase));
  }
}
