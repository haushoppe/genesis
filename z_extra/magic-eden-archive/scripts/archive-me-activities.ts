import * as path from 'path';
import * as fs from 'fs';
import { chromium, Page } from 'playwright';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TOKENS_DIR = path.join(DATA_DIR, 'tokens');
const ACTIVITIES_DIR = path.join(DATA_DIR, 'collection-activities');
const PROGRESS_FILE = path.join(DATA_DIR, 'me-activities-progress.json');
const LOG_FILE = path.join(DATA_DIR, 'me-activities.log');

const BASE_URL = 'https://api-mainnet.magiceden.io';
const DELAY_MIN_MS = 1000;       // target delay after warm-up
const DELAY_MAX_MS = 3000;       // start here and warm down
const DELAY_WARMUP_OK = 10;      // consecutive OKs before reducing delay
const DELAY_FLOOR_DECAY_OK = 50; // consecutive OKs before lowering the floor
const PAGE_LIMIT = 100;          // max results per page
const BACKOFF_INITIAL_MS = 10_000;
const BACKOFF_MAX_MS = 120_000;
const MAX_RETRIES = 5;
const STARTUP_COOLDOWN_S = 30;   // wait before first request (clear any penalty)

// All valid v4 activity types (discovered via Zod validation error)
const ACTIVITY_TYPES = [
  'ASK_CREATED',
  'ASK_CANCELLED',
  'BID_CREATED',
  'BID_CANCELLED',
  'BURN',
  'CREATE',
  'MINT',
  'TRANSFER',
  'TRADE',
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

interface ActivitiesProgress {
  completed: string[];
  empty: string[];       // collections with zero activities
  failed: string[];      // collections that errored out with zero data
  inProgress?: {         // partially fetched collection (for resume)
    symbol: string;
    cursorTimestamp: string;
    activities: number;
  };
}

function loadProgress(): ActivitiesProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { completed: [], empty: [], failed: [] };
}

function saveProgress(progress: ActivitiesProgress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// HTTP via Playwright
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(page: Page, url: string): Promise<{ status: number; data: any }> {
  const response = await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  const status = response?.status() ?? 0;

  if (status === 200) {
    const text = await page.evaluate(() => document.body.innerText);
    return { status, data: JSON.parse(text) };
  }

  return { status, data: null };
}

let currentDelay = DELAY_MAX_MS;
let delayFloor = DELAY_MIN_MS;   // learned safe minimum — rises on 429, decays on sustained success
let consecutiveOk = 0;
let consecutiveOkSinceFloor = 0; // tracks sustained success for floor decay

async function fetchWithRetry(page: Page, url: string): Promise<{ status: number; data: any }> {
  let backoff = BACKOFF_INITIAL_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (shuttingDown) throw new Error('SHUTDOWN');

    try {
      await sleep(currentDelay);
      const result = await fetchJson(page, url);

      if (result.status === 429) {
        // Learn: failed at currentDelay → floor is one step above
        delayFloor = Math.min(currentDelay + 200, DELAY_MAX_MS);
        currentDelay = Math.min(delayFloor + 400, DELAY_MAX_MS);
        consecutiveOk = 0;
        consecutiveOkSinceFloor = 0;
        log(`  [429] Backing off ${backoff / 1000}s, delay → ${currentDelay}ms, floor → ${delayFloor}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      if (result.status === 403) {
        delayFloor = Math.min(currentDelay + 200, DELAY_MAX_MS);
        currentDelay = Math.min(delayFloor + 400, DELAY_MAX_MS);
        consecutiveOk = 0;
        consecutiveOkSinceFloor = 0;
        log(`  [403] Cloudflare challenge. Backing off ${backoff / 1000}s, delay → ${currentDelay}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      if (result.status === 503) {
        log(`  [503] Service unavailable. Backing off ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      // Success — warm down delay, and decay floor over time
      consecutiveOk++;
      consecutiveOkSinceFloor++;

      // Decay the floor: if we've been clean for 50 OKs, the penalty is gone — lower the floor
      if (consecutiveOkSinceFloor >= DELAY_FLOOR_DECAY_OK && delayFloor > DELAY_MIN_MS) {
        delayFloor = Math.max(delayFloor - 200, DELAY_MIN_MS);
        consecutiveOkSinceFloor = 0;
        log(`  Floor decayed to ${delayFloor}ms`);
      }

      // Warm down delay toward floor
      if (consecutiveOk >= DELAY_WARMUP_OK && currentDelay > delayFloor) {
        currentDelay = Math.max(currentDelay - 200, delayFloor);
        consecutiveOk = 0;
        log(`  Delay reduced to ${currentDelay}ms (floor ${delayFloor}ms)`);
      }

      return result;
    } catch (err: any) {
      if (err.message === 'SHUTDOWN') throw err;

      if (attempt < MAX_RETRIES) {
        log(`  [${err.message?.slice(0, 60)}] Retrying in ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
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
// Build v4 activities URL
// ---------------------------------------------------------------------------

function buildActivitiesUrl(symbol: string, cursorTimestamp?: string): string {
  // Build URL manually — URLSearchParams encodes [] as %5B%5D which ME may reject
  const typeParams = ACTIVITY_TYPES.map(t => `activityTypes[]=${t}`).join('&');
  let url = `${BASE_URL}/v4/activity/nft?limit=${PAGE_LIMIT}&chain=bitcoin&${typeParams}&collectionId=${encodeURIComponent(symbol)}&sortBy=timestamp&sortDir=desc`;
  if (cursorTimestamp) {
    url += `&cursorTimestamp=${encodeURIComponent(cursorTimestamp)}`;
  }
  return url;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(ACTIVITIES_DIR, { recursive: true });

  // Get all unique symbols from token files
  const allSymbols = fs.readdirSync(TOKENS_DIR)
    .filter(f => f.endsWith('.ndjson') && !f.endsWith('.bis.ndjson'))
    .map(f => f.replace('.ndjson', ''))
    .sort();

  const progress = loadProgress();
  const skip = new Set([...progress.completed, ...progress.empty, ...progress.failed]);

  const todo = allSymbols.filter(s => !skip.has(s));

  log('='.repeat(70));
  log('ME Activities Archive v4 (Playwright)');
  log(`Total symbols: ${allSymbols.length} | Already done: ${skip.size} | TODO: ${todo.length}`);
  log(`Delay: ${DELAY_MAX_MS}ms → ${DELAY_MIN_MS}ms (warm down after ${DELAY_WARMUP_OK} OKs) | Page limit: ${PAGE_LIMIT} | Activity types: ${ACTIVITY_TYPES.length}`);
  log(`Endpoint: /v4/activity/nft (cursor-based pagination)`);
  log(`Dry run: ${DRY_RUN}`);
  log('='.repeat(70));

  if (todo.length === 0) {
    log('Nothing to do!');
    return;
  }

  // Startup cooldown — let any rate-limit penalty expire
  log(`Startup cooldown: ${STARTUP_COOLDOWN_S}s...`);
  for (let s = STARTUP_COOLDOWN_S; s > 0; s -= 10) {
    if (shuttingDown) return;
    log(`  ${s}s remaining...`);
    await sleep(Math.min(s, 10) * 1000);
  }

  // Launch headless browser
  log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let totalActivities = 0;
  let collectionsWithData = 0;
  let collectionsEmpty = 0;
  let apiCalls = 0;

  try {
    for (let i = 0; i < todo.length; i++) {
      if (shuttingDown) break;

      const symbol = todo[i];
      const filePath = path.join(ACTIVITIES_DIR, `${symbol}.ndjson`);

      // Resume support: pick up where we left off if this collection was in progress
      let cursorTimestamp: string | undefined;
      let collActivities = 0;
      if (progress.inProgress?.symbol === symbol) {
        cursorTimestamp = progress.inProgress.cursorTimestamp;
        collActivities = progress.inProgress.activities;
        log(`  Resuming ${symbol} at cursor ${cursorTimestamp} (${collActivities} already fetched)`);
      } else {
        // Starting fresh — truncate any leftover partial file to avoid duplicates
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      let pages = 0;
      let hitEnd = false;
      let erroredOut = false;

      while (!shuttingDown && !hitEnd) {
        const url = buildActivitiesUrl(symbol, cursorTimestamp);

        try {
          const { status, data } = await fetchWithRetry(page, url);
          apiCalls++;

          if (status === 404 || status === 400) {
            hitEnd = true;
            break;
          }

          if (status !== 200 || !data) {
            log(`  [${i + 1}/${todo.length}] Unexpected status ${status} for ${symbol}`);
            erroredOut = true;
            hitEnd = true;
            break;
          }

          // v4 response: { activities: [...], pagination: { cursorTimestamp: "..." } }
          const activities = data.activities;
          const items = Array.isArray(activities) ? activities : [];
          const nextCursor = data.pagination?.cursorTimestamp;

          pages++;

          if (items.length > 0) {
            fs.appendFileSync(filePath, items.map((a: any) => JSON.stringify(a)).join('\n') + '\n');
            collActivities += items.length;
          }

          // End conditions: no items, fewer than limit, or no next cursor
          if (items.length === 0 || items.length < PAGE_LIMIT || !nextCursor) {
            hitEnd = true;
          } else {
            cursorTimestamp = nextCursor;
          }

          // Log first collection with data
          if (collectionsWithData === 0 && pages === 1 && items.length > 0) {
            log(`  FIRST RESULT: ${symbol} — ${items.length} activities`);
            log(`  Sample: ${JSON.stringify(items[0]).slice(0, 300)}`);
          }

          // Progress logging within large collections
          if (pages % 50 === 0) {
            log(`    ${symbol}: page ${pages}, ${collActivities} activities`);
          }

          if (DRY_RUN && pages >= 3) { hitEnd = true; break; }

        } catch (err: any) {
          if (err.message === 'SHUTDOWN') break;
          log(`  [${i + 1}/${todo.length}] ERROR: ${symbol} page ${pages + 1} — ${err.message?.slice(0, 80)}`);
          erroredOut = true;
          hitEnd = true;
        }
      }

      // Save in-progress state on shutdown for resume
      if (shuttingDown) {
        if (collActivities > 0 && !hitEnd && cursorTimestamp) {
          progress.inProgress = { symbol, cursorTimestamp, activities: collActivities };
        }
        saveProgress(progress);
        break;
      }

      if (erroredOut && collActivities > 0 && cursorTimestamp) {
        // Partial data — save in-progress so we can resume from this cursor
        // If another collection was already inProgress, promote it to completed
        // (its partial file is on disk — better to keep partial data than lose it)
        if (progress.inProgress && progress.inProgress.symbol !== symbol) {
          progress.completed.push(progress.inProgress.symbol);
          log(`  Promoting previous inProgress ${progress.inProgress.symbol} to completed (${progress.inProgress.activities} activities, partial)`);
        }
        progress.inProgress = { symbol, cursorTimestamp, activities: collActivities };
        log(`  [${i + 1}/${todo.length}] PARTIAL: ${symbol} — ${collActivities} activities, will resume at cursor ${cursorTimestamp}`);
      } else if (erroredOut) {
        // Errored with zero data — mark failed so we don't retry forever
        progress.failed.push(symbol);
        progress.inProgress = undefined;
        collectionsEmpty++;
      } else if (collActivities > 0) {
        progress.completed.push(symbol);
        progress.inProgress = undefined;
        collectionsWithData++;
        totalActivities += collActivities;
        log(`  [${i + 1}/${todo.length}] ${symbol}: ${collActivities} activities (${pages} pages)`);
      } else {
        // Clean up empty file if created
        if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
          fs.unlinkSync(filePath);
        }
        progress.empty.push(symbol);
        progress.inProgress = undefined;
        collectionsEmpty++;
      }

      saveProgress(progress);

      // Progress logging every 100 collections
      if ((i + 1) % 100 === 0) {
        log(`  [${i + 1}/${todo.length}] with data: ${collectionsWithData}, empty: ${collectionsEmpty}, total activities: ${totalActivities.toLocaleString()}, API calls: ${apiCalls.toLocaleString()}`);
      }

      if (DRY_RUN && i >= 5) break;
    }
  } finally {
    await browser.close();
    log('Browser closed.');
  }

  log('='.repeat(70));
  log('ACTIVITIES v4 ARCHIVE COMPLETE');
  log(`Collections with data: ${collectionsWithData} | Empty: ${collectionsEmpty} | Activities: ${totalActivities.toLocaleString()} | API calls: ${apiCalls.toLocaleString()}`);
  log('='.repeat(70));
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
