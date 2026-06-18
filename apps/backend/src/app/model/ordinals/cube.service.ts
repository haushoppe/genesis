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
 * This service:
 *   - lazy-loads on the first request (no startup-time race),
 *   - serves from the in-memory cache afterwards,
 *   - re-fetches every 5 minutes to pick up new cron-committed cubes.
 */
@Injectable()
export class CubeService {

  private readonly logger = new Logger(CubeService.name);
  private readonly cubesUrl = 'https://ordpool-space.github.io/ordinal-cubes-index/data/cubes.json';

  private allCubes: InscriptionExtended[] = [];
  private inflight: Promise<InscriptionExtended[]> | null = null;

  /**
   * Returns all known cubes. If the cache is empty (typical on first call
   * after boot), trigger a fetch and await it before returning. Subsequent
   * concurrent callers share the same in-flight promise.
   */
  async getAllCubes(): Promise<InscriptionExtended[]> {
    if (this.allCubes.length > 0) return this.allCubes;
    return this.refresh();
  }

  /** Periodic refresh — picks up new cubes the hourly cron commits to the index repo. */
  @Interval(1000 * 60 * 5)
  async handleInterval() {
    try {
      await this.refresh();
    } catch {
      // already logged in refresh()
    }
  }

  // -------------------------------------------------------------------------

  private async refresh(): Promise<InscriptionExtended[]> {
    if (this.inflight) return this.inflight;
    this.inflight = this.doFetch().finally(() => { this.inflight = null; });
    return this.inflight;
  }

  private async doFetch(): Promise<InscriptionExtended[]> {
    try {
      const res = await fetch(this.cubesUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as ExternalCube[];
      const next = raw.map(toInscriptionExtended);

      // Only swap the cache if upstream is at least as big as what we already
      // have — guards against an upstream regression silently shrinking the list.
      if (next.length >= this.allCubes.length) {
        this.allCubes = next;
        this.logger.log(`Cubes refreshed: ${next.length} loaded`);
      } else {
        this.logger.warn(
          `Refused to overwrite cubes cache: upstream returned ${next.length}, local has ${this.allCubes.length}`,
        );
      }
      return this.allCubes;
    } catch (err) {
      this.logger.warn(`Cube refresh failed: ${err instanceof Error ? err.message : String(err)}`);
      // Return current cache (possibly empty) — callers that asked for cubes
      // see "no cubes yet" rather than getting an exception.
      return this.allCubes;
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
