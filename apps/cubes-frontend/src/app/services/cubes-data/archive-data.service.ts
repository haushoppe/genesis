import { Injectable } from '@angular/core';
import { parseCsv } from './csv';

const ARCHIVE_BASE = 'https://ordpool-space.github.io/magic-eden-ordinals-archive';

export interface ArchiveCollection {
  symbol: string;
  name: string;
  /** Cumulative all-time trading volume on Magic Eden, in sats. May be 0. */
  totalVolume: number;
}

export interface ArchiveInscription {
  id: string;
  contentType: string;
}

/**
 * Reads the frozen Magic Eden ordinals archive directly from GitHub Pages.
 * Cached for the rest of the session — the archive is immutable.
 */
@Injectable({ providedIn: 'root' })
export class ArchiveDataService {

  private indexPromise: Promise<ArchiveCollection[]> | null = null;
  private inscriptionsCache = new Map<string, Promise<ArchiveInscription[]>>();

  getCollections(): Promise<ArchiveCollection[]> {
    if (!this.indexPromise) {
      this.indexPromise = this.fetchIndex().catch((err) => {
        this.indexPromise = null;
        throw err;
      });
    }
    return this.indexPromise;
  }

  async getTopCollections(limit: number): Promise<ArchiveCollection[]> {
    return (await this.getCollections()).slice(0, limit);
  }

  async getCollection(symbol: string): Promise<ArchiveCollection | null> {
    return (await this.getCollections()).find((c) => c.symbol === symbol) ?? null;
  }

  getInscriptions(symbol: string): Promise<ArchiveInscription[]> {
    let cached = this.inscriptionsCache.get(symbol);
    if (!cached) {
      cached = this.fetchInscriptions(symbol).catch((err) => {
        this.inscriptionsCache.delete(symbol);
        throw err;
      });
      this.inscriptionsCache.set(symbol, cached);
    }
    return cached;
  }

  // -------------------------------------------------------------------------

  private async fetchIndex(): Promise<ArchiveCollection[]> {
    // Plain CSV — auto-decompressed in transit by GH Pages.
    const res = await fetch(`${ARCHIVE_BASE}/index.csv`);
    if (!res.ok) throw new Error(`Archive index fetch failed: HTTP ${res.status}`);
    const rows = parseCsv(await res.text()).slice(1); // skip header
    return rows
      .filter((r) => r.length >= 3 && r[0])
      .map(([symbol, name, totalVolume]) => ({
        symbol,
        name,
        totalVolume: Number(totalVolume) || 0,
      }));
  }

  private async fetchInscriptions(symbol: string): Promise<ArchiveInscription[]> {
    // Pre-gzipped — needs explicit DecompressionStream since GH Pages serves
    // .csv.gz as application/gzip, not as content-encoded text.
    const res = await fetch(`${ARCHIVE_BASE}/inscriptions/${encodeURIComponent(symbol)}.csv.gz`);
    if (!res.ok) throw new Error(`Inscriptions fetch for ${symbol} failed: HTTP ${res.status}`);
    const stream = res.body!.pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(stream).text();
    // Each line is `id,contentType` — both fields are comma-safe by construction
    // so a plain split is fine.
    return text
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => {
        const idx = line.indexOf(',');
        return { id: line.slice(0, idx), contentType: line.slice(idx + 1) };
      })
      .filter((x) => x.id);
  }
}
