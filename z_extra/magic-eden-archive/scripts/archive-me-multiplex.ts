import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import {
  GetTokensResponse,
} from '../../../apps/backend/src/app/types/ordinals/types-magic-eden';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TOKENS_DIR = path.join(DATA_DIR, 'tokens');
const PROGRESS_FILE = path.join(DATA_DIR, 'me-multiplex-progress.json');
const LOG_FILE = path.join(DATA_DIR, 'me-multiplex.log');

const DELAY_MIN_MS = 400;
const DELAY_MAX_MS = 2000;
const DELAY_COOLDOWN_FACTOR = 1.5;
const DELAY_WARMUP_REQUESTS = 50;
const DELAY_WARMUP_FACTOR = 0.9;
const BACKOFF_INITIAL_MS = 30_000;
const BACKOFF_MAX_MS = 600_000;
const MAX_RETRIES = 10;
const TOKENS_PAGE_SIZE = 40;

let currentDelay = DELAY_MIN_MS;
let okSinceLastAdjust = 0;

const DRY_RUN = process.argv.includes('--dry-run');

// All 6 sort variants — each returns a DIFFERENT slice at the offset boundary
const SORT_FIELDS = [
  'inscriptionNumberAsc',
  'inscriptionNumberDesc',
  'priceAsc',
  'priceDesc',
  'listedAtAsc',
  'listedAtDesc',
] as const;

type SortField = typeof SORT_FIELDS[number];

// Gap collections: NOT on BiS, stuck at ME 10,040 offset limit
// These are the 19 collections where sort multiplexing can help
const GAP_COLLECTIONS: { symbol: string; expectedSupply: number; currentArchived: number }[] = [
  { symbol: 'domain_dot_sats', expectedSupply: 489_739, currentArchived: 10_040 },
  { symbol: 'rare-sats', expectedSupply: 239_240, currentArchived: 0 },
  { symbol: 'domain_dot_unisat', expectedSupply: 232_033, currentArchived: 17_238 },
  { symbol: 'bitman', expectedSupply: 210_000, currentArchived: 11_344 },
  { symbol: 'brc1024_rootverse', expectedSupply: 210_000, currentArchived: 15_277 },
  { symbol: 'uniworlds-genesis', expectedSupply: 115_000, currentArchived: 14_906 },
  { symbol: 'gamestone', expectedSupply: 113_000, currentArchived: 16_238 },
  { symbol: 'sat20_rarepizza', expectedSupply: 99_000, currentArchived: 18_308 },
  { symbol: 'ainnrunestar', expectedSupply: 94_000, currentArchived: 18_626 },
  { symbol: 'sub-100k', expectedSupply: 90_000, currentArchived: 20_080 },
  { symbol: 'dogo', expectedSupply: 50_000, currentArchived: 16_858 },
  { symbol: 'runeratscoin', expectedSupply: 50_000, currentArchived: 19_436 },
  { symbol: 'thissongaboutnfts', expectedSupply: 42_000, currentArchived: 19_919 },
  { symbol: 'kards', expectedSupply: 42_000, currentArchived: 18_151 },
  { symbol: 'domain_dot_ord', expectedSupply: 32_000, currentArchived: 18_789 },
  { symbol: 'quadkey', expectedSupply: 31_000, currentArchived: 18_446 },
  { symbol: 'domain_dot_xbt', expectedSupply: 25_000, currentArchived: 19_204 },
  { symbol: 'domain_dot_bitter', expectedSupply: 21_000, currentArchived: 19_340 },
  { symbol: 'uncommons', expectedSupply: 22_000, currentArchived: 20_080 },
];

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let shuttingDown = false;
process.on('SIGINT', () => {
  log('\n*** SIGINT received. Saving and exiting...');
  shuttingDown = true;
});
process.on('SIGTERM', () => {
  log('\n*** SIGTERM received. Saving and exiting...');
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
// Progress
// ---------------------------------------------------------------------------

interface MultiplexProgress {
  // symbol → list of completed sort fields
  completed: Record<string, SortField[]>;
}

function loadProgress(): MultiplexProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { completed: {} };
}

function saveProgress(progress: MultiplexProgress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// Load existing token IDs from .ndjson file
// ---------------------------------------------------------------------------

async function loadExistingIds(filePath: string): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!fs.existsSync(filePath)) return ids;

  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.id) ids.add(obj.id);
    } catch { /* skip bad lines */ }
  }

  return ids;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimitedGet<T>(client: AxiosInstance, url: string, params?: Record<string, any>): Promise<T> {
  let backoff = BACKOFF_INITIAL_MS;
  let consecutiveTimeouts = 0;
  const MAX_CONSECUTIVE_TIMEOUTS = 3; // fast-fail on persistent timeouts

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (shuttingDown) throw new Error('SHUTDOWN');

    try {
      await sleep(currentDelay);
      const resp = await client.get<T>(url, { params });

      okSinceLastAdjust++;
      if (okSinceLastAdjust >= DELAY_WARMUP_REQUESTS && currentDelay > DELAY_MIN_MS) {
        const prev = currentDelay;
        currentDelay = Math.max(Math.round(currentDelay * DELAY_WARMUP_FACTOR), DELAY_MIN_MS);
        if (currentDelay !== prev) {
          log(`  [adaptive] ${prev}ms → ${currentDelay}ms (${DELAY_WARMUP_REQUESTS} OK in a row)`);
        }
        okSinceLastAdjust = 0;
      }

      return resp.data;
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 429) {
        const prev = currentDelay;
        currentDelay = Math.min(Math.round(currentDelay * DELAY_COOLDOWN_FACTOR), DELAY_MAX_MS);
        okSinceLastAdjust = 0;
        log(`  [429] Rate limited! Delay ${prev}ms → ${currentDelay}ms. Backing off ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      if (status === 400 || status === 404) throw err;

      // Fast-fail on persistent timeouts (ECONNABORTED = server can't handle this sort)
      if (err.code === 'ECONNABORTED') {
        consecutiveTimeouts++;
        if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
          log(`  [ECONNABORTED] ${MAX_CONSECUTIVE_TIMEOUTS} consecutive timeouts — this sort is unsupported, skipping`);
          throw err;
        }
        log(`  [ECONNABORTED] Timeout ${consecutiveTimeouts}/${MAX_CONSECUTIVE_TIMEOUTS}. Retrying in ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      if (attempt < MAX_RETRIES) {
        log(`  [${status || err.code}] Retrying in ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      throw err;
    }
  }

  throw new Error(`Failed after ${MAX_RETRIES} retries`);
}

// ---------------------------------------------------------------------------
// Token fetching — single sort field pass
// ---------------------------------------------------------------------------

async function fetchSortPass(
  client: AxiosInstance,
  symbol: string,
  filePath: string,
  sortBy: SortField,
  seenIds: Set<string>,
  targetSupply: number,
): Promise<{ newTokens: number; pages: number; hitLimit: boolean; reachedTarget: boolean }> {
  let offset = 0;
  let newTokenCount = 0;
  let pageCount = 0;
  let consecutiveZeroNewPages = 0;
  const MAX_ZERO_NEW_PAGES = 25; // bail if 25 consecutive pages yield 0 new tokens

  while (!shuttingDown) {
    try {
      const response = await rateLimitedGet<GetTokensResponse>(
        client,
        '/v2/ord/btc/tokens',
        { collectionSymbol: symbol, limit: TOKENS_PAGE_SIZE, offset, sortBy, showAll: 'true' }
      );

      const tokens = response.tokens || [];
      pageCount++;

      if (tokens.length === 0) break;

      const newTokens = tokens.filter(t => !seenIds.has((t as any).id));
      for (const t of newTokens) {
        seenIds.add((t as any).id);
      }
      newTokenCount += newTokens.length;

      if (newTokens.length > 0) {
        fs.appendFileSync(filePath, newTokens.map(t => JSON.stringify(t)).join('\n') + '\n');
        consecutiveZeroNewPages = 0;
      } else {
        consecutiveZeroNewPages++;
        if (consecutiveZeroNewPages >= MAX_ZERO_NEW_PAGES) {
          log(`      ${sortBy}: ${MAX_ZERO_NEW_PAGES} consecutive pages with 0 new tokens — skipping rest`);
          return { newTokens: newTokenCount, pages: pageCount, hitLimit: false, reachedTarget: false };
        }
      }

      // Stop early if we've reached the expected supply
      if (targetSupply > 0 && seenIds.size >= targetSupply) {
        log(`      ${sortBy}: reached target supply (${seenIds.size.toLocaleString()} >= ${targetSupply.toLocaleString()})!`);
        return { newTokens: newTokenCount, pages: pageCount, hitLimit: false, reachedTarget: true };
      }

      if (tokens.length < TOKENS_PAGE_SIZE) break;

      offset += TOKENS_PAGE_SIZE;

      if (pageCount % 50 === 0) {
        log(`      ${sortBy}: page ${pageCount}, offset ${offset}, +${newTokenCount} new unique`);
      }

      if (DRY_RUN && pageCount >= 3) break;
    } catch (err: any) {
      if (err.message === 'SHUTDOWN') break;

      const status = err?.response?.status;
      if (status === 400 && offset >= 10000) {
        log(`      ${sortBy}: offset limit at ${offset} (+${newTokenCount} new unique)`);
        return { newTokens: newTokenCount, pages: pageCount, hitLimit: true, reachedTarget: false };
      }
      if (status === 404 || status === 400) {
        return { newTokens: newTokenCount, pages: pageCount, hitLimit: false, reachedTarget: false };
      }

      log(`      ${sortBy}: ERROR at offset ${offset}: ${err.message}`);
      break;
    }
  }

  return { newTokens: newTokenCount, pages: pageCount, hitLimit: false, reachedTarget: false };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

async function countLines(filePath: string): Promise<number> {
  if (!fs.existsSync(filePath)) return 0;
  let count = 0;
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });
  const apiKey = process.env.MAGIC_EDEN_API_KEY;
  if (!apiKey) {
    log('FATAL: MAGIC_EDEN_API_KEY not found in .env');
    process.exit(1);
  }

  fs.mkdirSync(TOKENS_DIR, { recursive: true });

  const progress = loadProgress();

  // Sort collections: smallest gap first (maximize completions)
  const sorted = [...GAP_COLLECTIONS].sort((a, b) =>
    (a.expectedSupply - a.currentArchived) - (b.expectedSupply - b.currentArchived)
  );

  log('='.repeat(70));
  log('ME Sort Field Multiplexing — Gap Filler');
  log(`Collections: ${sorted.length} | Sort fields: ${SORT_FIELDS.length}`);
  log(`Delay: adaptive ${DELAY_MIN_MS}-${DELAY_MAX_MS}ms | Dry run: ${DRY_RUN}`);
  log('='.repeat(70));

  const client = axios.create({
    baseURL: 'https://api-mainnet.magiceden.dev',
    timeout: 120_000, // 120s — price/listedAt sorts can be slow for large collections
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  let collIdx = 0;
  for (const { symbol, expectedSupply, currentArchived } of sorted) {
    if (shuttingDown) break;
    collIdx++;

    const sanitized = sanitizeFilename(symbol);
    const filePath = path.join(TOKENS_DIR, `${sanitized}.ndjson`);

    // Determine which sort fields are already done for this collection
    const doneSorts = new Set(progress.completed[symbol] || []);

    // Heuristic: check what the original archive already did based on token count
    // - Exactly ≤ 10,040 tokens → only inscriptionNumberAsc was done
    // - > 10,040 tokens → both inscriptionNumber sorts were done
    // (Don't hardcode — some collections like domain_dot_sats only had forward pass!)
    const existingCount = await countLines(filePath);

    if (existingCount > 10_040) {
      // Both inscriptionNumber sorts were done by original archive
      if (!doneSorts.has('inscriptionNumberAsc')) doneSorts.add('inscriptionNumberAsc');
      if (!doneSorts.has('inscriptionNumberDesc')) doneSorts.add('inscriptionNumberDesc');
    } else if (existingCount > 0) {
      // Only forward pass was done
      if (!doneSorts.has('inscriptionNumberAsc')) doneSorts.add('inscriptionNumberAsc');
    }

    const todoSorts = SORT_FIELDS.filter(s => !doneSorts.has(s));

    if (todoSorts.length === 0) {
      log(`  [${collIdx}/${sorted.length}] SKIP ${symbol} — all sort fields done`);
      continue;
    }

    // Load existing token IDs from the .ndjson file
    log(`  [${collIdx}/${sorted.length}] Loading existing tokens for "${symbol}"...`);
    const seenIds = await loadExistingIds(filePath);
    const startCount = seenIds.size;
    log(`    Loaded ${startCount.toLocaleString()} existing tokens. Gap: ~${(expectedSupply - startCount).toLocaleString()}`);
    log(`    Sort fields TODO: ${todoSorts.join(', ')}`);

    let reachedTarget = false;
    for (const sortBy of todoSorts) {
      if (shuttingDown) break;

      // Skip remaining sorts if we already have enough tokens
      if (seenIds.size >= expectedSupply) {
        log(`    SKIP ${sortBy} — already at target (${seenIds.size.toLocaleString()} >= ${expectedSupply.toLocaleString()})`);
        if (!progress.completed[symbol]) progress.completed[symbol] = [];
        progress.completed[symbol].push(sortBy);
        saveProgress(progress);
        reachedTarget = true;
        continue;
      }

      log(`    Running ${sortBy}...`);
      const result = await fetchSortPass(client, symbol, filePath, sortBy, seenIds, expectedSupply);
      log(`    ${sortBy}: +${result.newTokens.toLocaleString()} new (${result.pages} pages${result.hitLimit ? ', hit limit' : ''}${result.reachedTarget ? ', TARGET REACHED!' : ''})`);

      // Mark this sort field as done
      if (!progress.completed[symbol]) progress.completed[symbol] = [];
      progress.completed[symbol].push(sortBy);
      saveProgress(progress);

      if (result.reachedTarget) {
        reachedTarget = true;
      }
    }

    const totalNow = seenIds.size;
    const pct = expectedSupply > 0 ? ((totalNow / expectedSupply) * 100).toFixed(1) : '?';
    const status = reachedTarget ? ' *** COMPLETE!' : '';
    log(`  ${symbol}: ${startCount.toLocaleString()} → ${totalNow.toLocaleString()} (+${(totalNow - startCount).toLocaleString()}) = ${pct}% of ${expectedSupply.toLocaleString()}${status}`);

    if (shuttingDown) { saveProgress(progress); break; }
  }

  // Final summary — count lines efficiently via streaming
  log('='.repeat(70));
  log('SORT FIELD MULTIPLEXING COMPLETE');
  log('');
  for (const { symbol, expectedSupply } of sorted) {
    const sanitized = sanitizeFilename(symbol);
    const fp = path.join(TOKENS_DIR, `${sanitized}.ndjson`);
    if (fs.existsSync(fp)) {
      const lineCount = await countLines(fp);
      const pct = expectedSupply > 0 ? ((lineCount / expectedSupply) * 100).toFixed(1) : '?';
      log(`  ${symbol}: ${lineCount.toLocaleString()} / ${expectedSupply.toLocaleString()} (${pct}%)`);
    }
  }
  log('='.repeat(70));
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
