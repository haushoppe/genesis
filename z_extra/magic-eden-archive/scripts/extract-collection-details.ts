import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TOKENS_DIR = path.join(DATA_DIR, 'tokens');
const COLLECTIONS_DIR = path.join(DATA_DIR, 'collections');
const STATS_DIR = path.join(DATA_DIR, 'collection-stats');

const DELAY_MIN_MS = 400;
const DELAY_MAX_MS = 2000;
const DELAY_COOLDOWN_FACTOR = 1.5;
const DELAY_WARMUP_REQUESTS = 3;
const DELAY_WARMUP_FACTOR = 0.9;
const BACKOFF_INITIAL_MS = 30_000;
const BACKOFF_MAX_MS = 300_000;
const MAX_RETRIES = 10;

// Start at max delay and warm down — avoids 429 storms when the API
// rate limiter is still in penalty state from a previous script run.
let currentDelay = DELAY_MAX_MS;
let okSinceLastAdjust = 0;

let shuttingDown = false;
process.on('SIGINT', () => { console.log('\n*** SIGINT received. Exiting...'); shuttingDown = true; });
process.on('SIGTERM', () => { console.log('\n*** SIGTERM received. Exiting...'); shuttingDown = true; });

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimitedGet<T>(client: AxiosInstance, url: string, params?: Record<string, any>): Promise<T> {
  let backoff = BACKOFF_INITIAL_MS;

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
          console.log(`  [adaptive] ${prev}ms → ${currentDelay}ms`);
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
        console.log(`  [429] Delay ${prev}ms → ${currentDelay}ms. Backing off ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      if (status === 400 || status === 404) throw err;

      if (attempt < MAX_RETRIES) {
        console.log(`  [${status || err.code}] Retrying in ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      throw err;
    }
  }

  throw new Error(`Failed after ${MAX_RETRIES} retries`);
}

async function main() {
  dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });
  const apiKey = process.env.MAGIC_EDEN_API_KEY;
  if (!apiKey) { console.error('FATAL: MAGIC_EDEN_API_KEY not found in .env'); process.exit(1); }

  const client = axios.create({
    baseURL: 'https://api-mainnet.magiceden.dev',
    timeout: 30_000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  fs.mkdirSync(COLLECTIONS_DIR, { recursive: true });
  fs.mkdirSync(STATS_DIR, { recursive: true });

  // Get all unique symbols from token files
  const symbols = new Set<string>();
  for (const file of fs.readdirSync(TOKENS_DIR).filter(f => f.endsWith('.ndjson'))) {
    symbols.add(file.replace('.bis.ndjson', '').replace('.ndjson', ''));
  }

  // Figure out what needs fetching
  const needsDetail: string[] = [];
  const needsStats: string[] = [];
  for (const s of Array.from(symbols).sort()) {
    if (!fs.existsSync(path.join(COLLECTIONS_DIR, `${s}.json`))) needsDetail.push(s);
    if (!fs.existsSync(path.join(STATS_DIR, `${s}.json`))) needsStats.push(s);
  }

  const totalCalls = needsDetail.length + needsStats.length;
  console.log(`Total symbols: ${symbols.size}`);
  console.log(`Details TODO: ${needsDetail.length} | Stats TODO: ${needsStats.length}`);
  console.log(`Total API calls: ~${totalCalls} | Delay: adaptive ${DELAY_MIN_MS}-${DELAY_MAX_MS}ms`);

  if (totalCalls === 0) { console.log('Nothing to do!'); return; }

  // Startup cooldown — give the API rate limiter time to reset after previous script runs
  const STARTUP_COOLDOWN_S = 120;
  console.log(`\nWaiting ${STARTUP_COOLDOWN_S}s startup cooldown (API rate limiter reset)...`);
  await sleep(STARTUP_COOLDOWN_S * 1000);

  let detailFetched = 0, detailNotFound = 0;
  let statsFetched = 0, statsNotFound = 0;
  let callCount = 0;

  // Pass 1: Collection details
  if (needsDetail.length > 0) {
    console.log(`\n--- Fetching ${needsDetail.length} collection details ---`);
    for (let i = 0; i < needsDetail.length; i++) {
      if (shuttingDown) break;
      const symbol = needsDetail[i];

      try {
        const data = await rateLimitedGet<any>(client, `/v2/ord/btc/collections/${encodeURIComponent(symbol)}`);
        if (data) {
          fs.writeFileSync(path.join(COLLECTIONS_DIR, `${symbol}.json`), JSON.stringify(data, null, 2));
          detailFetched++;
          // Log first result fully, then every 50th
          if (detailFetched === 1) {
            console.log(`  FIRST DETAIL: ${symbol} — keys: ${Object.keys(data).join(', ')}`);
          }
        } else {
          detailNotFound++;
          console.log(`  [${i + 1}/${needsDetail.length}] EMPTY response: ${symbol}`);
        }
      } catch (err: any) {
        if (err.message === 'SHUTDOWN') break;
        const status = err?.response?.status;
        if (status === 404 || status === 400) {
          detailNotFound++;
          console.log(`  [${i + 1}/${needsDetail.length}] NOT FOUND: ${symbol} (${status})`);
        } else {
          console.log(`  [${i + 1}/${needsDetail.length}] ERROR: ${symbol} (${status || err.code})`);
        }
      }

      callCount++;
      if ((i + 1) % 50 === 0) {
        console.log(`  [${i + 1}/${needsDetail.length}] fetched: ${detailFetched}, not found: ${detailNotFound}, delay: ${currentDelay}ms`);
      }
    }
    console.log(`Details done. Fetched: ${detailFetched} | Not found: ${detailNotFound}`);
  }

  // Pass 2: Collection stats
  if (needsStats.length > 0 && !shuttingDown) {
    console.log(`\n--- Fetching ${needsStats.length} collection stats ---`);
    for (let i = 0; i < needsStats.length; i++) {
      if (shuttingDown) break;
      const symbol = needsStats[i];

      try {
        // Undocumented endpoint — guessed from the API surface. Returned 200 once, untested at scale.
        const data = await rateLimitedGet<any>(client, '/v2/ord/btc/stat', {
          collectionSymbol: symbol,
          window: '30d',
        });
        if (data) {
          fs.writeFileSync(path.join(STATS_DIR, `${symbol}.json`), JSON.stringify(data, null, 2));
          statsFetched++;
          // Log first result fully to verify structure
          if (statsFetched === 1) {
            console.log(`  FIRST STAT: ${symbol} — keys: ${Object.keys(data).join(', ')}`);
            console.log(`  FIRST STAT sample: ${JSON.stringify(data).slice(0, 300)}`);
          }
          if (statsFetched <= 5) {
            const vol = data.totalVol ?? data.totalVolume ?? data.vol ?? '??';
            const txns = data.totalTxns ?? data.totalTransactions ?? data.txns ?? '??';
            console.log(`  STAT #${statsFetched}: ${symbol} — totalVol: ${vol}, totalTxns: ${txns}`);
          }
        } else {
          statsNotFound++;
          console.log(`  [${i + 1}/${needsStats.length}] EMPTY stat: ${symbol}`);
        }
      } catch (err: any) {
        if (err.message === 'SHUTDOWN') break;
        const status = err?.response?.status;
        if (status === 404 || status === 400) {
          statsNotFound++;
          // Log first few not-founds
          if (statsNotFound <= 5) {
            console.log(`  STAT NOT FOUND #${statsNotFound}: ${symbol} (${status})`);
          }
        } else {
          console.log(`  [${i + 1}/${needsStats.length}] STAT ERROR: ${symbol} (${status || err.code})`);
        }
      }

      callCount++;
      if ((i + 1) % 50 === 0) {
        console.log(`  [${i + 1}/${needsStats.length}] stats fetched: ${statsFetched}, not found: ${statsNotFound}, delay: ${currentDelay}ms`);
      }
    }
    console.log(`Stats done. Fetched: ${statsFetched} | Not found: ${statsNotFound}`);
  }

  console.log(`\nTotal: ${callCount} API calls | Details: ${detailFetched} fetched, ${detailNotFound} not found | Stats: ${statsFetched} fetched, ${statsNotFound} not found`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
