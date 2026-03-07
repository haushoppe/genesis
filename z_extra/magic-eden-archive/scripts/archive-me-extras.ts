import * as path from 'path';
import * as fs from 'fs';
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
const PROGRESS_FILE = path.join(DATA_DIR, 'me-extras-progress.json');
const LOG_FILE = path.join(DATA_DIR, 'me-extras.log');

const DELAY_MIN_MS = 400;
const DELAY_MAX_MS = 2000;
const DELAY_COOLDOWN_FACTOR = 1.5;  // multiply delay by this on 429
const DELAY_WARMUP_REQUESTS = 50;   // after this many OK requests, reduce delay
const DELAY_WARMUP_FACTOR = 0.9;    // multiply delay by this when warming up
const BACKOFF_INITIAL_MS = 30_000;
const BACKOFF_MAX_MS = 600_000;
const MAX_RETRIES = 10;
const TOKENS_PAGE_SIZE = 40;

let currentDelay = DELAY_MIN_MS;
let okSinceLastAdjust = 0;

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Load extra symbols from legacy repo + manual additions
// ---------------------------------------------------------------------------

function loadExtraSymbols(): string[] {
  const archived = new Set(
    fs.readdirSync(TOKENS_DIR)
      .filter(f => f.endsWith('.ndjson') && !f.endsWith('.bis.ndjson'))
      .map(f => f.replace('.ndjson', ''))
  );

  // Track symbol → estimated supply for sorting
  const supplyMap = new Map<string, number>();
  const symbols = new Set<string>();

  // 1. Manual additions (known collections not in any discovery source)
  const manual = [
    'ordinal-cubes-by-haus-hoppe',
    'counterfeit-saints',
    'ord-signals-in-noise',
    // Discovered via meta-collections (uncommons, sub-100k)
    'a_b_c', 'bitx_runes_dex', 'cat20_pass', 'dimons', 'dog-of-bitcoin',
    'dollar', 'echoes_of_midnight_on_the_ridge', 'haunted_photography',
    'mdd', 'natsnow', 'ordiapes', 'pikas', 'rns', 'theintensityforlife',
    // Discovered via phase 1 stats (missed in earlier runs)
    'labitbus', 'brc20_\u{1F5C1}',
    // Discovered via summraznboi/magic-eden-data-dump CSV
    '100m', '490', 'bit-coins', 'block994', 'brc9999', 'brcdiamonds',
    'btc-jmk_creation_key', 'classifiedcartel', 'egyptian_hieroglyphs',
    'erl3', 'faces', 'hoodi', 'ittanmoment', 'j-art-collection',
    'kanetix', 'liquid-art-capital', 'lorn-horde', 'mm9', 'mumu', 'not',
    'ntendre', 'ogbrc20-domo', 'ogbrc20-meme', 'ogbrc20-pups',
    'ordinal-exclams', 'proxima', 'rare-sats', 'runesorbit', 'runespace',
    'scres', 'testingjj', 'watermargin108',
  ];
  for (const s of manual) { symbols.add(s); supplyMap.set(s, 0); }

  // 2. Legacy repo collections.json
  const legacyBase = path.resolve(__dirname, '..', 'ordinals-collections', 'legacy');
  const legacyMetaFile = path.join(legacyBase, 'collections.json');
  if (fs.existsSync(legacyMetaFile)) {
    try {
      const meta: { symbol: string; supply?: number }[] = JSON.parse(fs.readFileSync(legacyMetaFile, 'utf-8'));
      for (const c of meta) {
        if (c.symbol) {
          symbols.add(c.symbol);
          if (c.supply) supplyMap.set(c.symbol, c.supply);
        }
      }
    } catch { /* ignore */ }
  }

  // 3. v4 search discovery results (from discover-collections.ts)
  const v4File = path.join(DATA_DIR, 'v4-search-collections.json');
  if (fs.existsSync(v4File)) {
    try {
      const v4: { symbol: string; totalItems?: number }[] = JSON.parse(fs.readFileSync(v4File, 'utf-8'));
      for (const c of v4) {
        if (c.symbol) {
          symbols.add(c.symbol);
          if (c.totalItems) supplyMap.set(c.symbol, c.totalItems);
        }
      }
      log(`Loaded ${v4.length} symbols from v4 search discovery`);
    } catch { /* ignore */ }
  }

  // Filter out already-archived collections, sort by supply ascending (small first)
  const extras = Array.from(symbols).filter(s => !archived.has(s) && !archived.has(sanitizeFilename(s)));

  extras.sort((a, b) => (supplyMap.get(a) || 0) - (supplyMap.get(b) || 0));

  return extras;
}

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

interface ExtrasProgress {
  completed: string[];
  notFound: string[];  // symbols that don't exist on ME
  failed: string[];
}

function loadProgress(): ExtrasProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { completed: [], notFound: [], failed: [] };
}

function saveProgress(progress: ExtrasProgress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimitedGet<T>(client: AxiosInstance, url: string, params?: Record<string, any>): Promise<T> {
  let backoff = BACKOFF_INITIAL_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (shuttingDown) throw new Error('SHUTDOWN');

    try {
      await sleep(currentDelay);
      const resp = await client.get<T>(url, { params });

      // Adaptive warmup: after enough OK requests, slowly reduce delay
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
        // Adaptive cooldown: increase base delay on rate limit
        const prev = currentDelay;
        currentDelay = Math.min(Math.round(currentDelay * DELAY_COOLDOWN_FACTOR), DELAY_MAX_MS);
        okSinceLastAdjust = 0;
        log(`  [429] Rate limited! Delay ${prev}ms → ${currentDelay}ms. Backing off ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      if (status === 400 || status === 404) throw err;

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
// Token fetching (forward + reverse pass, same as main archive script)
// ---------------------------------------------------------------------------

async function fetchTokenPass(
  client: AxiosInstance,
  symbol: string,
  filePath: string,
  sortBy: 'inscriptionNumberAsc' | 'inscriptionNumberDesc',
  seenIds: Set<string>,
): Promise<{ tokens: number; pages: number; hitLimit: boolean; notFound: boolean }> {
  let offset = 0;
  let totalTokens = 0;
  let pageCount = 0;

  while (!shuttingDown) {
    try {
      const response = await rateLimitedGet<GetTokensResponse>(
        client,
        '/v2/ord/btc/tokens',
        { collectionSymbol: symbol, limit: TOKENS_PAGE_SIZE, offset, sortBy, showAll: 'true' }
      );

      const tokens = response.tokens || [];
      pageCount++;

      if (pageCount === 1 && tokens.length === 0) {
        return { tokens: 0, pages: 1, hitLimit: false, notFound: true };
      }

      const newTokens = tokens.filter(t => !seenIds.has((t as any).id));
      for (const t of newTokens) {
        seenIds.add((t as any).id);
      }
      totalTokens += newTokens.length;

      if (newTokens.length > 0) {
        fs.appendFileSync(filePath, newTokens.map(t => JSON.stringify(t)).join('\n') + '\n');
      }

      if (tokens.length < TOKENS_PAGE_SIZE) break;

      offset += TOKENS_PAGE_SIZE;

      if (pageCount % 25 === 0) {
        log(`      ${sortBy}: page ${pageCount}, offset ${offset}, +${totalTokens} unique`);
      }

      if (DRY_RUN && pageCount >= 2) break;
    } catch (err: any) {
      if (err.message === 'SHUTDOWN') break;

      const status = err?.response?.status;
      if (status === 400 && offset >= 10000) {
        log(`    ${sortBy}: offset limit at ${offset} (+${totalTokens} unique)`);
        return { tokens: totalTokens, pages: pageCount, hitLimit: true, notFound: false };
      }
      if (status === 404 || status === 400) {
        return { tokens: totalTokens, pages: pageCount, hitLimit: false, notFound: offset === 0 };
      }

      log(`    ${sortBy}: ERROR at offset ${offset}: ${err.message}`);
      break;
    }
  }

  return { tokens: totalTokens, pages: pageCount, hitLimit: false, notFound: false };
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
  dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });
  const apiKey = process.env.MAGIC_EDEN_API_KEY;
  if (!apiKey) {
    log('FATAL: MAGIC_EDEN_API_KEY not found in .env');
    process.exit(1);
  }

  fs.mkdirSync(TOKENS_DIR, { recursive: true });

  const extraSymbols = loadExtraSymbols();
  const progress = loadProgress();
  const skip = new Set([...progress.completed, ...progress.notFound, ...progress.failed]);
  const todo = extraSymbols.filter(s => !skip.has(s));

  log('='.repeat(70));
  log('ME Extra Collections Archive');
  log(`Total extra symbols: ${extraSymbols.length} | Already processed: ${skip.size} | TODO: ${todo.length}`);
  log(`Delay: adaptive ${DELAY_MIN_MS}-${DELAY_MAX_MS}ms (start: ${currentDelay}ms) | Dry run: ${DRY_RUN}`);
  log('='.repeat(70));

  if (todo.length === 0) {
    log('Nothing to do!');
    return;
  }

  const client = axios.create({
    baseURL: 'https://api-mainnet.magiceden.dev',
    timeout: 30_000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  let count = 0;
  for (const symbol of todo) {
    if (shuttingDown) break;

    count++;
    const sanitized = sanitizeFilename(symbol);
    const filePath = path.join(TOKENS_DIR, `${sanitized}.ndjson`);

    // SAFETY: never overwrite existing files
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      if (size > 0) {
        log(`  [${count}/${todo.length}] SKIP ${symbol} — file already exists (${size} bytes)`);
        progress.completed.push(symbol);
        saveProgress(progress);
        continue;
      }
    }

    log(`  [${count}/${todo.length}] Fetching "${symbol}"...`);

    fs.writeFileSync(filePath, '');
    const seenIds = new Set<string>();

    // Forward pass
    const fwd = await fetchTokenPass(client, symbol, filePath, 'inscriptionNumberAsc', seenIds);

    if (fwd.notFound) {
      log(`    NOT FOUND on ME — skipping`);
      progress.notFound.push(symbol);
      fs.unlinkSync(filePath); // clean up empty file
      saveProgress(progress);
      continue;
    }

    if (shuttingDown) { saveProgress(progress); break; }

    // Reverse pass if needed
    let rev = { tokens: 0, pages: 0, hitLimit: false, notFound: false };
    if (fwd.hitLimit) {
      log(`    Forward: ${fwd.tokens} tokens. Starting reverse pass...`);
      rev = await fetchTokenPass(client, symbol, filePath, 'inscriptionNumberDesc', seenIds);
      if (shuttingDown) { saveProgress(progress); break; }
    }

    const total = fwd.tokens + rev.tokens;

    if (total === 0) {
      log(`    Empty collection — removing file`);
      fs.unlinkSync(filePath);
      progress.notFound.push(symbol);
    } else {
      log(`    Done: ${total} tokens (fwd: ${fwd.tokens}${rev.tokens ? ', rev: ' + rev.tokens : ''})`);
      progress.completed.push(symbol);
    }

    saveProgress(progress);
  }

  log('='.repeat(70));
  log('EXTRA COLLECTIONS ARCHIVE COMPLETE');
  log(`Completed: ${progress.completed.length} | Not found: ${progress.notFound.length} | Failed: ${progress.failed.length}`);
  log('='.repeat(70));
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
