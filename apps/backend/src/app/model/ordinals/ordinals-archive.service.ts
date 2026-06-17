import { Injectable, Logger } from '@nestjs/common';
import { gunzipSync } from 'zlib';

/**
 * A single collection entry from the archive index.
 */
export interface ArchiveCollection {
  symbol: string;
  name: string;
  /** Cumulative all-time trading volume on Magic Eden, in sats. May be 0. */
  totalVolume: number;
}

/**
 * One inscription as recorded in an archive collection CSV.
 */
export interface ArchiveInscription {
  id: string;
  contentType: string;
}

/**
 * Reads the frozen Magic Eden ordinals archive published at
 *   https://github.com/ordpool-space/magic-eden-ordinals-archive
 *
 * The archive is static and immutable (Magic Eden shut down its ordinals API
 * in March 2026). Everything is cached forever after the first hit.
 */
@Injectable()
export class OrdinalsArchiveService {

  private readonly logger = new Logger(OrdinalsArchiveService.name);
  private readonly baseUrl = 'https://ordpool-space.github.io/magic-eden-ordinals-archive';

  private indexPromise: Promise<ArchiveCollection[]> | null = null;
  private inscriptionsCache = new Map<string, Promise<ArchiveInscription[]>>();

  /** All collections, sorted by `totalVolume` descending. Cached. */
  async getCollections(): Promise<ArchiveCollection[]> {
    if (!this.indexPromise) {
      this.indexPromise = this.fetchIndex().catch(err => {
        this.indexPromise = null;   // allow retry on next call
        throw err;
      });
    }
    return this.indexPromise;
  }

  /** Top N collections by `totalVolume` desc. */
  async getTopCollections(limit: number): Promise<ArchiveCollection[]> {
    const all = await this.getCollections();
    return all.slice(0, limit);
  }

  /** Lookup a single collection by symbol. Returns `null` if unknown. */
  async getCollection(symbol: string): Promise<ArchiveCollection | null> {
    const all = await this.getCollections();
    return all.find(c => c.symbol === symbol) ?? null;
  }

  /** All inscriptions in a collection (id + contentType). Cached per symbol. */
  async getInscriptions(symbol: string): Promise<ArchiveInscription[]> {
    let cached = this.inscriptionsCache.get(symbol);
    if (!cached) {
      cached = this.fetchInscriptions(symbol).catch(err => {
        this.inscriptionsCache.delete(symbol);
        throw err;
      });
      this.inscriptionsCache.set(symbol, cached);
    }
    return cached;
  }

  // -------------------------------------------------------------------------
  // Fetch helpers
  // -------------------------------------------------------------------------

  private async fetchIndex(): Promise<ArchiveCollection[]> {
    const url = `${this.baseUrl}/index.csv`;
    this.logger.log(`Fetching archive index from ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Archive index fetch failed: HTTP ${res.status}`);
    return parseIndexCsv(await res.text());
  }

  private async fetchInscriptions(symbol: string): Promise<ArchiveInscription[]> {
    const url = `${this.baseUrl}/inscriptions/${encodeURIComponent(symbol)}.csv.gz`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Inscriptions fetch for ${symbol} failed: HTTP ${res.status}`);
    const csv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf-8');
    return parseInscriptionsCsv(csv);
  }
}

// ---------------------------------------------------------------------------
// CSV parsers
// ---------------------------------------------------------------------------

/**
 * RFC 4180 parser for the small index file — 20 of the 5,466 collection names
 * contain commas/quotes that require proper quoting.
 */
function parseIndexCsv(text: string): ArchiveCollection[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') { field += c; }
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  // Skip header row.
  return rows.slice(1)
    .filter(r => r.length >= 3 && r[0])
    .map(([symbol, name, totalVolume]) => ({
      symbol,
      name,
      totalVolume: Number(totalVolume) || 0,
    }));
}

/**
 * Plain split is enough — inscription IDs are hex+`i`+digit and content types
 * like `image/png` never contain commas.
 */
function parseInscriptionsCsv(text: string): ArchiveInscription[] {
  const lines = text.trim().split('\n');
  return lines.slice(1)
    .map(line => {
      const idx = line.indexOf(',');
      if (idx < 0) return null;
      return { id: line.slice(0, idx), contentType: line.slice(idx + 1) };
    })
    .filter((x): x is ArchiveInscription => x !== null && !!x.id);
}
