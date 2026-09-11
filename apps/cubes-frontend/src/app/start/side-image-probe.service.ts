import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { probeSideImages, SideImageVerdict } from './side-image-check';

/**
 * Injectable front for `probeSideImages`, so a spec can replace the
 * browser round trip with a stub. Probes against the same host the cubes
 * index probes (`api.ordpool.space`), so the mint form and the score
 * agree on what renders.
 */
@Injectable({ providedIn: 'root' })
export class SideImageProbeService {
  probe(ids: readonly string[]): Observable<Record<string, SideImageVerdict>> {
    return from(probeSideImages(ids, environment.mempoolApiUrl));
  }
}
