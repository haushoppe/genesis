import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { InscriptionExtended } from '../../types/ordinals/inscription-extended';

/**
 * Source of truth for known cubes.
 *
 * Replaces the previous OrdinalsBot polling implementation, which broke when
 * OrdinalsBot's search indexer went offline (June 2026). Cube data is now
 * indexed by a separate, self-hosted pipeline:
 *
 *   https://github.com/ordpool-space/ordinal-cubes-index
 *
 * A GitHub Action there walks our own ord (ord.ordpool.space) forward via the
 * inscription `next` linked list, identifies cubes by their HTML marker, and
 * commits the result to data/cubes.json — served on GitHub Pages.
 *
 * This service just pulls that JSON on an interval and caches it in memory.
 * Tiny, no third-party dependency, easy to reason about.
 */
@Injectable()
export class CubeService {

  private readonly logger = new Logger(CubeService.name);
  private readonly cubesUrl = 'https://ordpool-space.github.io/ordinal-cubes-index/data/cubes.json';

  private allCubes: InscriptionExtended[] = [];

  async onModuleInit() {
    this.logger.log('Initializing CubeService. Loading cubes from public index…');
    // Don't await — let the first fetch happen in the background so app startup
    // isn't blocked by a slow CDN response. The first request that needs cubes
    // will see an empty array; subsequent requests get the cached list.
    void this.refresh();
  }

  /** Hourly refresh — keep in step with the cron that updates cubes-index. */
  @Interval(1000 * 60 * 60)
  async handleInterval() {
    await this.refresh();
  }

  async getAllCubes(): Promise<InscriptionExtended[]> {
    return this.allCubes;
  }

  // -------------------------------------------------------------------------

  private async refresh(): Promise<void> {
    try {
      const res = await fetch(this.cubesUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as ExternalCube[];
      const cubes = raw.map(toInscriptionExtended);

      // Only swap the cache if we got at least the count we already have — guards
      // against an upstream regression silently shrinking the list.
      if (cubes.length >= this.allCubes.length) {
        this.allCubes = cubes;
        this.logger.log(`Cubes refreshed: ${cubes.length} loaded`);
      } else {
        this.logger.warn(
          `Refused to overwrite cubes cache: upstream returned ${cubes.length}, ` +
          `local has ${this.allCubes.length}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Cube refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Shape of the records in cubes.json (kept private to this service).
// ---------------------------------------------------------------------------

interface ExternalCube {
  inscriptionId: string;
  inscriptionNumber: number;
  blockHeight: number;
  timestamp?: number;
  contentLength?: number;
  attributes: { trait_type: string; value: string }[];
  name: string;
}

function toInscriptionExtended(c: ExternalCube): InscriptionExtended {
  return {
    inscriptionId: c.inscriptionId,
    inscriptionNumber: c.inscriptionNumber,
    blockHeight: c.blockHeight,
    meta: { name: c.name, attributes: c.attributes },
  };
}
