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
const PROGRESS_FILE = path.join(DATA_DIR, 'me-snowball-progress.json');
const LOG_FILE = path.join(DATA_DIR, 'me-snowball.log');

const DELAY_MIN_MS = 200;
const DELAY_MAX_MS = 2000;
const DELAY_COOLDOWN_FACTOR = 1.5;
const DELAY_WARMUP_REQUESTS = 50;
const DELAY_WARMUP_FACTOR = 0.9;
const BACKOFF_INITIAL_MS = 30_000;
const BACKOFF_MAX_MS = 300_000;
const MAX_RETRIES = 10;
const MAX_CONSECUTIVE_TIMEOUTS = 3;
const TOKENS_PAGE_SIZE = 100; // ownerAddress queries can use limit=100

let currentDelay = DELAY_MIN_MS;
let okSinceLastAdjust = 0;

const DRY_RUN = process.argv.includes('--dry-run');

// Gap collections to snowball
const GAP_COLLECTIONS: { symbol: string; expectedSupply: number }[] = [
  { symbol: 'uncommons', expectedSupply: 22_000 },
  { symbol: 'domain_dot_bitter', expectedSupply: 21_000 },
  { symbol: 'domain_dot_xbt', expectedSupply: 25_000 },
  { symbol: 'quadkey', expectedSupply: 31_000 },
  { symbol: 'domain_dot_ord', expectedSupply: 32_000 },
  { symbol: 'kards', expectedSupply: 42_000 },
  { symbol: 'thissongaboutnfts', expectedSupply: 42_000 },
  { symbol: 'runeratscoin', expectedSupply: 50_000 },
  { symbol: 'dogo', expectedSupply: 50_000 },
  { symbol: 'sub-100k', expectedSupply: 90_000 },
  { symbol: 'ainnrunestar', expectedSupply: 94_000 },
  { symbol: 'sat20_rarepizza', expectedSupply: 99_000 },
  { symbol: 'gamestone', expectedSupply: 113_000 },
  { symbol: 'uniworlds-genesis', expectedSupply: 115_000 },
  { symbol: 'brc1024_rootverse', expectedSupply: 210_000 },
  { symbol: 'bitman', expectedSupply: 210_000 },
  { symbol: 'domain_dot_unisat', expectedSupply: 232_033 },
  { symbol: 'rare-sats', expectedSupply: 239_240 },
  { symbol: 'domain_dot_sats', expectedSupply: 489_739 },
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

interface SnowballProgress {
  // symbol → { queriedWallets: string[], round: number }
  collections: Record<string, {
    queriedWallets: string[];
    round: number;
    tokensBefore: number;
    tokensAfter: number;
  }>;
}

function loadProgress(): SnowballProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { collections: {} };
}

function saveProgress(progress: SnowballProgress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// Load existing data from .ndjson file (single pass: ids + wallets + counts)
// ---------------------------------------------------------------------------

async function loadExistingData(filePath: string): Promise<{
  ids: Set<string>;
  wallets: Set<string>;
  walletTokenCounts: Map<string, number>;
}> {
  const ids = new Set<string>();
  const wallets = new Set<string>();
  const walletTokenCounts = new Map<string, number>();
  if (!fs.existsSync(filePath)) return { ids, wallets, walletTokenCounts };

  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.id) ids.add(obj.id);
      if (obj.owner) {
        wallets.add(obj.owner);
        walletTokenCounts.set(obj.owner, (walletTokenCounts.get(obj.owner) || 0) + 1);
      }
    } catch { /* skip */ }
  }

  return { ids, wallets, walletTokenCounts };
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
          log(`  [adaptive] ${prev}ms → ${currentDelay}ms`);
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
        log(`  [429] Delay ${prev}ms → ${currentDelay}ms. Backing off ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      if (status === 400 || status === 404) throw err;

      if (err.code === 'ECONNABORTED') {
        consecutiveTimeouts++;
        if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
          throw err;
        }
        log(`  [ECONNABORTED] Timeout ${consecutiveTimeouts}/${MAX_CONSECUTIVE_TIMEOUTS}. Retrying in ${backoff / 1000}s`);
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
// Fetch all tokens for a specific owner in a collection
// ---------------------------------------------------------------------------

async function fetchOwnerTokens(
  client: AxiosInstance,
  symbol: string,
  ownerAddress: string,
  filePath: string,
  seenIds: Set<string>,
): Promise<{ newTokens: number }> {
  let offset = 0;
  let newTokenCount = 0;

  while (!shuttingDown) {
    try {
      const response = await rateLimitedGet<GetTokensResponse>(
        client,
        '/v2/ord/btc/tokens',
        {
          collectionSymbol: symbol,
          ownerAddress,
          limit: TOKENS_PAGE_SIZE,
          offset,
          showAll: 'true',
        }
      );

      const tokens = response.tokens || [];
      if (tokens.length === 0) break;

      const newTokens = tokens.filter(t => !seenIds.has((t as any).id));
      for (const t of newTokens) {
        seenIds.add((t as any).id);
      }
      newTokenCount += newTokens.length;

      if (newTokens.length > 0) {
        fs.appendFileSync(filePath, newTokens.map(t => JSON.stringify(t)).join('\n') + '\n');
      }

      if (tokens.length < TOKENS_PAGE_SIZE) break;
      offset += TOKENS_PAGE_SIZE;

      if (DRY_RUN && offset >= 200) break;
    } catch (err: any) {
      if (err.message === 'SHUTDOWN') break;
      const status = err?.response?.status;
      if (status === 400 && offset >= 10000) break; // offset limit
      if (status === 404 || status === 400) break;
      log(`    Owner ${ownerAddress.slice(0,12)}... ERROR at offset ${offset}: ${err.message}`);
      break;
    }
  }

  return { newTokens: newTokenCount };
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

  const progress = loadProgress();

  const client = axios.create({
    baseURL: 'https://api-mainnet.magiceden.dev',
    timeout: 120_000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  // Sort by smallest gap first
  const sorted = [...GAP_COLLECTIONS].sort((a, b) => a.expectedSupply - b.expectedSupply);

  log('='.repeat(70));
  log('ME Snowball Archive — ownerAddress-based gap filler');
  log(`Collections: ${sorted.length} | Page size: ${TOKENS_PAGE_SIZE}`);
  log(`Delay: adaptive ${DELAY_MIN_MS}-${DELAY_MAX_MS}ms | Dry run: ${DRY_RUN}`);
  log('='.repeat(70));

  for (const { symbol, expectedSupply } of sorted) {
    if (shuttingDown) break;

    const sanitized = sanitizeFilename(symbol);
    const filePath = path.join(TOKENS_DIR, `${sanitized}.ndjson`);

    // Load existing data (single pass: ids + wallets + per-wallet counts)
    log(`\n  Loading "${symbol}"...`);
    const { ids: seenIds, wallets: knownWallets, walletTokenCounts } = await loadExistingData(filePath);
    const startCount = seenIds.size;

    // Note: NOT skipping based on expectedSupply — ME's totalSupply is inaccurate

    // Get already-queried wallets from progress
    const collProgress = progress.collections[symbol] || { queriedWallets: [], round: 0, tokensBefore: startCount, tokensAfter: startCount };
    const queriedWallets = new Set(collProgress.queriedWallets);

    // Wallets to query = known wallets minus already queried
    // Sort by token count descending — whales first (most likely to yield new tokens)
    const pendingWallets = Array.from(knownWallets)
      .filter(w => !queriedWallets.has(w))
      .sort((a, b) => (walletTokenCounts.get(b) || 0) - (walletTokenCounts.get(a) || 0));

    log(`  ${symbol}: ${startCount.toLocaleString()} tokens, ${knownWallets.size.toLocaleString()} known wallets, ${pendingWallets.length.toLocaleString()} pending, ${queriedWallets.size.toLocaleString()} already queried`);
    if (pendingWallets.length > 0) {
      const topCount = walletTokenCounts.get(pendingWallets[0]) || 0;
      log(`  Top whale holds ${topCount} tokens in archive — querying whales first`);
    }

    if (pendingWallets.length === 0) {
      log(`  No pending wallets — already exhausted for ${symbol}`);
      continue;
    }

    let totalNewTokens = 0;
    let walletsProcessed = 0;
    let walletsWithNewTokens = 0;
    let consecutiveZeroWallets = 0;
    const MAX_CONSECUTIVE_ZERO_WALLETS = 500; // bail-out: whales first, so tail is very unlikely to yield
    const batchSize = 100; // save progress every 100 wallets

    for (let i = 0; i < pendingWallets.length; i++) {
      if (shuttingDown) break;

      // No target exit — ME's totalSupply is inaccurate
      // No bail-out — query EVERY wallet exhaustively

      const wallet = pendingWallets[i];
      const result = await fetchOwnerTokens(client, symbol, wallet, filePath, seenIds);

      queriedWallets.add(wallet);
      walletsProcessed++;
      totalNewTokens += result.newTokens;

      if (result.newTokens > 0) {
        walletsWithNewTokens++;
        consecutiveZeroWallets = 0;
      } else {
        consecutiveZeroWallets++;
      }

      // Progress logging — every 50 wallets, or when a wallet yields 10+ new tokens
      if (walletsProcessed % 50 === 0 || result.newTokens >= 10) {
        const pct = expectedSupply > 0 ? ((seenIds.size / expectedSupply) * 100).toFixed(1) : '?';
        log(`    [${walletsProcessed}/${pendingWallets.length}] +${totalNewTokens.toLocaleString()} new, ${seenIds.size.toLocaleString()} (${pct}%), ${walletsWithNewTokens} productive wallets, ${consecutiveZeroWallets} consecutive zeros${result.newTokens > 0 ? ` | this wallet +${result.newTokens}` : ''}`);
      }

      // Save progress periodically
      if (walletsProcessed % batchSize === 0) {
        progress.collections[symbol] = {
          queriedWallets: Array.from(queriedWallets),
          round: 1,
          tokensBefore: startCount,
          tokensAfter: seenIds.size,
        };
        saveProgress(progress);
      }

      if (DRY_RUN && walletsProcessed >= 20) break;
    }

    const pct = expectedSupply > 0 ? ((seenIds.size / expectedSupply) * 100).toFixed(1) : '?';
    log(`  ${symbol}: ${startCount.toLocaleString()} → ${seenIds.size.toLocaleString()} (+${totalNewTokens.toLocaleString()}) = ${pct}% of ${expectedSupply.toLocaleString()}`);

    // Final save
    progress.collections[symbol] = {
      queriedWallets: Array.from(queriedWallets),
      round: 1,
      tokensBefore: startCount,
      tokensAfter: seenIds.size,
    };
    saveProgress(progress);
  }

  log('='.repeat(70));
  log('SNOWBALL COMPLETE');
  log('='.repeat(70));
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
