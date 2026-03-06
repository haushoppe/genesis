import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'v4-search-collections.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'v4-search-progress.json');
const LOG_FILE = path.join(DATA_DIR, 'v4-search.log');

const BASE_DELAY_MS = 1000;
const PAGE_SIZE = 100;
const MAX_OFFSET = 4000; // empirically, offset ≥4000 returns empty

// Search patterns: a-z, 0-9, plus some special chars
const PATTERNS = [
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
  ...'0123456789'.split(''),
];

const DRY_RUN = process.argv.includes('--dry-run');

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

interface SearchProgress {
  completedPatterns: string[];
  collections: Record<string, SearchCollection>;
}

interface SearchCollection {
  symbol: string;
  name: string;
  totalItems: number;
  totalVol: string;
  floorPrice: number | null;
  image: string;
  isVerified: boolean;
  blockchain: string;
}

function loadProgress(): SearchProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { completedPatterns: [], collections: {} };
}

function saveProgress(progress: SearchProgress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const client = axios.create({
  baseURL: 'https://api-mainnet.magiceden.io',
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
});

interface V4SearchResult {
  collectionsV2: {
    collectionId: string;
    name: string;
    symbol: string;
    blockchain: string;
    image: string;
    isVerified: boolean;
    totalItems: number;
    totalVol: string;
    floorPrice: number | null;
  }[];
}

async function searchCollections(pattern: string, offset: number): Promise<V4SearchResult> {
  let backoff = 5_000;

  for (let attempt = 1; attempt <= 10; attempt++) {
    if (shuttingDown) throw new Error('SHUTDOWN');

    try {
      await sleep(BASE_DELAY_MS);
      const resp = await client.post<V4SearchResult>('/v4/search/search', {
        pattern,
        chains: ['bitcoin'],
        limit: PAGE_SIZE,
        offset,
      });
      return resp.data;
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 429) {
        log(`  [429] Rate limited. Backing off ${backoff / 1000}s (attempt ${attempt}/10)`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 120_000);
        continue;
      }

      if (attempt < 10) {
        log(`  [${status || err.code}] Error. Retrying in ${backoff / 1000}s (attempt ${attempt}/10)`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 120_000);
        continue;
      }

      throw err;
    }
  }

  throw new Error('Failed after 10 retries');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const progress = loadProgress();
  const skip = new Set(progress.completedPatterns);
  const todo = PATTERNS.filter(p => !skip.has(p));

  log('='.repeat(70));
  log('ME v4 Search — Collection Discovery');
  log(`Patterns: ${PATTERNS.length} | Already done: ${skip.size} | TODO: ${todo.length}`);
  log(`Known collections so far: ${Object.keys(progress.collections).length}`);
  log(`Delay: ${BASE_DELAY_MS}ms | Dry run: ${DRY_RUN}`);
  log('='.repeat(70));

  if (todo.length === 0) {
    log('All patterns already searched!');
    saveFinalOutput(progress);
    return;
  }

  let totalRequests = 0;

  for (const pattern of todo) {
    if (shuttingDown) break;

    const beforeCount = Object.keys(progress.collections).length;
    let offset = 0;
    let pageCount = 0;
    let patternNewCount = 0;

    while (!shuttingDown) {
      if (offset > MAX_OFFSET) {
        log(`  "${pattern}": hit max offset ${MAX_OFFSET}`);
        break;
      }

      try {
        const result = await searchCollections(pattern, offset);
        totalRequests++;
        pageCount++;

        const items = result.collectionsV2 || [];

        if (items.length === 0) break;

        for (const item of items) {
          if (!progress.collections[item.symbol]) {
            patternNewCount++;
            progress.collections[item.symbol] = {
              symbol: item.symbol,
              name: item.name,
              totalItems: item.totalItems,
              totalVol: item.totalVol,
              floorPrice: item.floorPrice,
              image: item.image,
              isVerified: item.isVerified,
              blockchain: item.blockchain,
            };
          }
        }

        if (items.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;

        if (DRY_RUN && pageCount >= 2) break;
      } catch (err: any) {
        if (err.message === 'SHUTDOWN') break;
        log(`  "${pattern}" ERROR at offset ${offset}: ${err.message}`);
        break;
      }
    }

    if (!shuttingDown) {
      progress.completedPatterns.push(pattern);
      const totalNow = Object.keys(progress.collections).length;
      log(`  "${pattern}": ${pageCount} pages, +${patternNewCount} new → ${totalNow} total collections`);
      saveProgress(progress);
    }

    if (DRY_RUN && totalRequests >= 10) break;
  }

  saveFinalOutput(progress);

  log('='.repeat(70));
  log('DISCOVERY COMPLETE');
  log(`Total collections found: ${Object.keys(progress.collections).length}`);
  log(`Total API requests: ${totalRequests}`);
  log('='.repeat(70));
}

function saveFinalOutput(progress: SearchProgress) {
  const collections = Object.values(progress.collections)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(collections, null, 2));
  log(`Saved ${collections.length} collections to ${OUTPUT_FILE}`);
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
