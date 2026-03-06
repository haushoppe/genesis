import * as path from 'path';
import * as fs from 'fs';
import axios, { AxiosInstance } from 'axios';
import {
  GetCollectionStatisticsOptions,
  GetCollectionStatisticsResult,
  GetCollectionResult,
  GetTokensOptions,
  GetTokensResponse,
} from '../../../apps/backend/src/app/types/ordinals/types-magic-eden';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');
const LOG_FILE = path.join(DATA_DIR, 'archive.log');

const BASE_DELAY_MS = 2000;
const BACKOFF_INITIAL_MS = 30_000;
const BACKOFF_MAX_MS = 600_000; // 10 minutes
const MAX_RETRIES = 10;
const TOKENS_PAGE_SIZE = 40;

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_PHASE1 = process.argv.includes('--skip-phase1');
const SKIP_PHASE2 = process.argv.includes('--skip-phase2');
const ONLY_PHASE1 = process.argv.includes('--only-phase1');

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let shuttingDown = false;
process.on('SIGINT', () => {
  log('\n*** SIGINT received. Finishing current request, then saving and exiting...');
  shuttingDown = true;
});
process.on('SIGTERM', () => {
  log('\n*** SIGTERM received. Finishing current request, then saving and exiting...');
  shuttingDown = true;
});

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

interface Progress {
  phase1Complete: boolean;
  phase2: { completed: string[]; failed: string[] };
  phase3: {
    completed: string[];
    inProgress: { symbol: string; offset: number } | null;
    failed: string[];
  };
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {
    phase1Complete: false,
    phase2: { completed: [], failed: [] },
    phase3: { completed: [], inProgress: null, failed: [] },
  };
}

function saveProgress(progress: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

function createApiClient(): AxiosInstance {
  // Load .env manually
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }

  const apiKey = process.env.MAGIC_EDEN_API_KEY;
  if (!apiKey || apiKey === 'xxx') {
    console.error('ERROR: MAGIC_EDEN_API_KEY not set or placeholder. Check .env file.');
    process.exit(1);
  }

  log(`API key loaded: ${apiKey.slice(0, 8)}...`);

  return axios.create({
    baseURL: 'https://api-mainnet.magiceden.dev',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Rate-limited request helper
// ---------------------------------------------------------------------------

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let lastRequestTime = 0;

async function rateLimitedGet<T>(client: AxiosInstance, url: string, params?: Record<string, any>): Promise<T> {
  // Enforce minimum delay between requests
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < BASE_DELAY_MS) {
    await sleep(BASE_DELAY_MS - elapsed);
  }

  let backoff = BACKOFF_INITIAL_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (shuttingDown) throw new Error('SHUTDOWN');

    try {
      lastRequestTime = Date.now();
      const response = await client.get<T>(url, { params });
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 429) {
        log(`  429 Rate limited! Backing off ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})...`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      // 400 = bad request, don't retry (offset limit, invalid params, etc.)
      if (status === 400) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        log(`  Error ${status || error.code || error.message} on ${url} — retrying in 2s (attempt ${attempt}/${MAX_RETRIES})...`);
        await sleep(2000);
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Failed after ${MAX_RETRIES} retries: ${url}`);
}

// ---------------------------------------------------------------------------
// Phase 1: Collection Discovery
// ---------------------------------------------------------------------------

const SORT_FIELDS: GetCollectionStatisticsOptions['sort'][] = [
  'volume', 'volumePercentageChange', 'totalVolume',
  'sales', 'salesPercentageChange', 'totalSales',
  'floorPrice', 'floorPricePercentageChange', 'topOffer',
  'listedOverSupply', 'ownerPercentage', 'pending', 'marketCap',
];

const WINDOWS: GetCollectionStatisticsOptions['window'][] = ['1h', '6h', '1d', '7d', '30d'];
const DIRECTIONS: GetCollectionStatisticsOptions['direction'][] = ['desc', 'asc'];

async function phase1(client: AxiosInstance): Promise<Map<string, GetCollectionStatisticsResult>> {
  log('=== PHASE 1: Collection Discovery ===');

  const collectionsMap = new Map<string, GetCollectionStatisticsResult>();

  // Load existing phase1 data if resuming
  const phase1File = path.join(DATA_DIR, 'phase1-collections.json');
  if (fs.existsSync(phase1File)) {
    try {
      const existing: GetCollectionStatisticsResult[] = JSON.parse(fs.readFileSync(phase1File, 'utf-8'));
      for (const c of existing) {
        collectionsMap.set(c.collectionSymbol, c);
      }
      log(`Loaded ${collectionsMap.size} existing collections from previous phase 1 run`);
    } catch { /* ignore */ }
  }

  const combos: { sort: typeof SORT_FIELDS[number]; window: typeof WINDOWS[number]; direction: typeof DIRECTIONS[number] }[] = [];
  for (const sort of SORT_FIELDS) {
    for (const window of WINDOWS) {
      for (const direction of DIRECTIONS) {
        combos.push({ sort, window, direction });
      }
    }
  }

  if (DRY_RUN) {
    combos.length = 1; // Only first combo in dry run
  }

  let queryCount = 0;
  for (const combo of combos) {
    if (shuttingDown) break;

    queryCount++;
    const params: GetCollectionStatisticsOptions = {
      sort: combo.sort,
      window: combo.window,
      direction: combo.direction,
      offset: 0,
      limit: 1000,
    };

    try {
      const results = await rateLimitedGet<GetCollectionStatisticsResult[]>(
        client,
        '/collection_stats/search/bitcoin',
        params as any
      );

      let newCount = 0;
      for (const r of results) {
        if (!collectionsMap.has(r.collectionSymbol)) {
          newCount++;
        }
        // Always update with latest stats
        collectionsMap.set(r.collectionSymbol, { ...r, symbol: r.collectionSymbol });
      }

      log(`  [${queryCount}/${combos.length}] ${combo.sort}/${combo.window}/${combo.direction}: ${results.length} results, ${newCount} new → total ${collectionsMap.size}`);
    } catch (error: any) {
      if (error.message === 'SHUTDOWN') break;
      log(`  [${queryCount}/${combos.length}] ERROR ${combo.sort}/${combo.window}/${combo.direction}: ${error.message}`);
    }
  }

  // Save results
  const allCollections = Array.from(collectionsMap.values());
  fs.writeFileSync(phase1File, JSON.stringify(allCollections, null, 2));
  log(`Phase 1 complete: ${allCollections.length} unique collections discovered and saved.`);

  return collectionsMap;
}

// ---------------------------------------------------------------------------
// Phase 2: Collection Details
// ---------------------------------------------------------------------------

async function phase2(client: AxiosInstance, collections: Map<string, GetCollectionStatisticsResult>, progress: Progress) {
  log('=== PHASE 2: Collection Details ===');

  const collectionsDir = path.join(DATA_DIR, 'collections');
  fs.mkdirSync(collectionsDir, { recursive: true });

  const symbols = Array.from(collections.keys());
  const completed = new Set(progress.phase2.completed);
  const todo = symbols.filter(s => !completed.has(s));

  if (DRY_RUN) {
    todo.length = Math.min(todo.length, 3);
  }

  log(`  ${completed.size} already done, ${todo.length} remaining`);

  let count = 0;
  for (const symbol of todo) {
    if (shuttingDown) break;

    count++;
    try {
      const details = await rateLimitedGet<GetCollectionResult>(
        client,
        `/v2/ord/btc/collections/${encodeURIComponent(symbol)}`
      );

      const filePath = path.join(collectionsDir, `${sanitizeFilename(symbol)}.json`);
      fs.writeFileSync(filePath, JSON.stringify(details, null, 2));

      progress.phase2.completed.push(symbol);
      if (count % 50 === 0) {
        saveProgress(progress);
        log(`  [${count}/${todo.length}] Progress saved. Latest: ${symbol}`);
      } else if (count % 10 === 0) {
        log(`  [${count}/${todo.length}] ${symbol}`);
      }
    } catch (error: any) {
      if (error.message === 'SHUTDOWN') break;
      log(`  [${count}/${todo.length}] FAILED ${symbol}: ${error.message}`);
      progress.phase2.failed.push(symbol);
    }
  }

  saveProgress(progress);
  log(`Phase 2 complete: ${progress.phase2.completed.length} details saved, ${progress.phase2.failed.length} failed.`);
}

// ---------------------------------------------------------------------------
// Phase 3: Token Dump (forward + reverse pass for large collections)
// ---------------------------------------------------------------------------

/**
 * Paginate through tokens in one direction until done or hitting the offset limit.
 * Returns the number of unique tokens written.
 */
async function fetchTokenPass(
  client: AxiosInstance,
  symbol: string,
  filePath: string,
  sortBy: 'inscriptionNumberAsc' | 'inscriptionNumberDesc',
  seenIds: Set<string>,
): Promise<{ tokens: number; pages: number; hitLimit: boolean; error: boolean }> {
  let offset = 0;
  let totalTokens = 0;
  let pageCount = 0;
  let hitLimit = false;
  let error = false;

  while (!shuttingDown) {
    try {
      const response = await rateLimitedGet<GetTokensResponse>(
        client,
        '/v2/ord/btc/tokens',
        { collectionSymbol: symbol, limit: TOKENS_PAGE_SIZE, offset, sortBy, showAll: 'true' }
      );

      const tokens = response.tokens || [];
      pageCount++;

      // Deduplicate and append
      const newTokens = tokens.filter(t => !seenIds.has((t as any).id));
      for (const t of newTokens) {
        seenIds.add((t as any).id);
      }
      totalTokens += newTokens.length;

      if (newTokens.length > 0) {
        const lines = newTokens.map(t => JSON.stringify(t)).join('\n') + '\n';
        fs.appendFileSync(filePath, lines);
      }

      if (tokens.length < TOKENS_PAGE_SIZE) {
        break; // Last page
      }

      offset += TOKENS_PAGE_SIZE;

      if (pageCount % 25 === 0) {
        log(`      ${sortBy}: page ${pageCount}, offset ${offset}, +${totalTokens} unique tokens`);
      }

      if (DRY_RUN && pageCount >= 2) break;
    } catch (err: any) {
      if (err.message === 'SHUTDOWN') break;

      const status = err?.response?.status;
      if (status === 400 && offset >= 10000) {
        log(`    ${sortBy}: offset limit hit at ${offset} (+${totalTokens} unique tokens)`);
        hitLimit = true;
        break;
      }

      log(`    ${sortBy}: ERROR at offset ${offset}: ${err.message}`);
      error = true;
      break;
    }
  }

  return { tokens: totalTokens, pages: pageCount, hitLimit, error };
}

async function phase3(client: AxiosInstance, collections: Map<string, GetCollectionStatisticsResult>, progress: Progress) {
  log('=== PHASE 3: Token Dump ===');
  log('  Format: NDJSON (one JSON object per line, appended incrementally)');
  log('  Strategy: forward pass + reverse pass for collections > 10K tokens');

  const tokensDir = path.join(DATA_DIR, 'tokens');
  fs.mkdirSync(tokensDir, { recursive: true });

  // Sort collections by totalSupply ascending (small ones first for max breadth)
  const sortedSymbols = Array.from(collections.entries())
    .sort((a, b) => (a[1].totalSupply || 0) - (b[1].totalSupply || 0))
    .map(([symbol]) => symbol);

  const completed = new Set(progress.phase3.completed);
  const todo = sortedSymbols.filter(s => !completed.has(s));

  if (DRY_RUN) {
    todo.length = Math.min(todo.length, 3);
  }

  log(`  ${completed.size} already done, ${todo.length} remaining`);

  let collectionCount = 0;
  for (const symbol of todo) {
    if (shuttingDown) break;

    collectionCount++;
    const supply = collections.get(symbol)?.totalSupply || '?';
    log(`  [${collectionCount}/${todo.length}] Fetching tokens for "${symbol}" (supply: ${supply})...`);

    const sanitized = sanitizeFilename(symbol);
    const filePath = path.join(tokensDir, `${sanitized}.ndjson`);

    // Always start fresh
    fs.writeFileSync(filePath, '');
    const seenIds = new Set<string>();

    // Forward pass (ascending)
    const fwd = await fetchTokenPass(client, symbol, filePath, 'inscriptionNumberAsc', seenIds);
    if (fwd.error) {
      log(`    FAILED (forward pass error)`);
      if (!progress.phase3.failed.includes(symbol)) {
        progress.phase3.failed.push(symbol);
      }
      continue;
    }
    if (shuttingDown) {
      saveProgress(progress);
      break;
    }

    // Reverse pass only if forward hit the offset limit
    let rev = { tokens: 0, pages: 0, hitLimit: false, error: false };
    if (fwd.hitLimit) {
      log(`    Forward: ${fwd.tokens} tokens. Starting reverse pass...`);
      rev = await fetchTokenPass(client, symbol, filePath, 'inscriptionNumberDesc', seenIds);
      if (rev.error) {
        log(`    Reverse pass error — keeping forward data only`);
      }
      if (shuttingDown) {
        saveProgress(progress);
        break;
      }
    }

    const totalTokens = fwd.tokens + rev.tokens;
    const gap = typeof supply === 'number' ? supply - totalTokens : 0;

    // Remove from failed if it was there (re-run scenario)
    progress.phase3.failed = progress.phase3.failed.filter(s => s !== symbol);
    progress.phase3.completed.push(symbol);
    progress.phase3.inProgress = null;

    if (gap > 0) {
      log(`    Done: ${totalTokens} tokens (fwd: ${fwd.tokens}, rev: ${rev.tokens}) — GAP: ${gap} missing from middle`);
    } else {
      log(`    Done: ${totalTokens} tokens in ${fwd.pages + rev.pages} pages`);
    }

    if (collectionCount % 10 === 0) {
      saveProgress(progress);
    }
  }

  saveProgress(progress);
  log(`Phase 3 complete: ${progress.phase3.completed.length} collections archived, ${progress.phase3.failed.length} failed.`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log('========================================');
  log('Magic Eden Ordinals Archive Script');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'FULL RUN'}`);
  log('========================================');

  // Ensure data directories exist
  fs.mkdirSync(path.join(DATA_DIR, 'collections'), { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'tokens'), { recursive: true });

  const client = createApiClient();
  const progress = loadProgress();

  // Phase 1: Discover collections
  let collections: Map<string, GetCollectionStatisticsResult>;

  if (SKIP_PHASE1 && progress.phase1Complete) {
    log('Skipping Phase 1 (--skip-phase1 flag and previous run exists)');
    const phase1File = path.join(DATA_DIR, 'phase1-collections.json');
    const data: GetCollectionStatisticsResult[] = JSON.parse(fs.readFileSync(phase1File, 'utf-8'));
    collections = new Map(data.map(c => [c.collectionSymbol, c]));
    log(`Loaded ${collections.size} collections from previous Phase 1`);
  } else {
    collections = await phase1(client);
    progress.phase1Complete = true;
    saveProgress(progress);
  }

  if (shuttingDown || ONLY_PHASE1) {
    log('Exiting after Phase 1.');
    return;
  }

  // Phase 2: Collection details
  if (!SKIP_PHASE2) {
    await phase2(client, collections, progress);
  } else {
    log('Skipping Phase 2 (--skip-phase2 flag)');
  }

  if (shuttingDown) {
    log('Exiting after Phase 2.');
    return;
  }

  // Phase 3: Token dump
  await phase3(client, collections, progress);

  if (shuttingDown) {
    log('Graceful shutdown complete. Run again to resume.');
  } else {
    log('========================================');
    log('ALL PHASES COMPLETE!');
    log(`Collections discovered: ${collections.size}`);
    log(`Collection details saved: ${progress.phase2.completed.length}`);
    log(`Token dumps completed: ${progress.phase3.completed.length}`);
    log(`Failed: Phase2=${progress.phase2.failed.length}, Phase3=${progress.phase3.failed.length}`);
    log('========================================');
  }
}

main().catch(err => {
  log(`FATAL ERROR: ${err.message}`);
  console.error(err);
  process.exit(1);
});
