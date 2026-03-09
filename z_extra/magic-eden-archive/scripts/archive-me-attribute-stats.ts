import * as path from 'path';
import * as fs from 'fs';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TOKENS_DIR = path.join(DATA_DIR, 'tokens');
const ATTRIBUTES_DIR = path.join(DATA_DIR, 'collection-attributes');
const PROGRESS_FILE = path.join(DATA_DIR, 'me-attribute-stats-progress.json');
const LOG_FILE = path.join(DATA_DIR, 'me-attribute-stats.log');

const BASE_URL = 'https://api-mainnet.magiceden.io';
const DELAY_MS = 1000;          // base delay between requests
const BACKOFF_INITIAL_MS = 10_000;
const BACKOFF_MAX_MS = 120_000;
const MAX_RETRIES = 5;

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

interface AttributeStatsProgress {
  completed: string[];
  notFound: string[];
  empty: string[];
}

function loadProgress(): AttributeStatsProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { completed: [], notFound: [], empty: [] };
}

function saveProgress(progress: AttributeStatsProgress) {
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

async function fetchWithRetry(page: Page, url: string): Promise<{ status: number; data: any }> {
  let backoff = BACKOFF_INITIAL_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (shuttingDown) throw new Error('SHUTDOWN');

    try {
      await sleep(DELAY_MS);
      const result = await fetchJson(page, url);

      if (result.status === 429) {
        log(`  [429] Backing off ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      if (result.status === 403) {
        // Cloudflare challenge — wait and retry
        log(`  [403] Cloudflare challenge. Backing off ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(ATTRIBUTES_DIR, { recursive: true });

  // Get all unique symbols from token files
  const allSymbols = fs.readdirSync(TOKENS_DIR)
    .filter(f => f.endsWith('.ndjson') && !f.endsWith('.bis.ndjson'))
    .map(f => f.replace('.ndjson', ''))
    .sort();

  const progress = loadProgress();
  const skip = new Set([...progress.completed, ...progress.notFound, ...progress.empty]);

  // Also skip if file already exists on disk
  for (const sym of allSymbols) {
    if (fs.existsSync(path.join(ATTRIBUTES_DIR, `${sym}.json`))) {
      skip.add(sym);
    }
  }

  const todo = allSymbols.filter(s => !skip.has(s));

  log('='.repeat(70));
  log('ME Attribute Stats Archive (Playwright)');
  log(`Total symbols: ${allSymbols.length} | Already done: ${skip.size} | TODO: ${todo.length}`);
  log(`Delay: ${DELAY_MS}ms | Dry run: ${DRY_RUN}`);
  log('='.repeat(70));

  if (todo.length === 0) {
    log('Nothing to do!');
    return;
  }

  // Launch headless browser
  log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let fetched = 0;
  let notFound = 0;
  let empty = 0;

  try {
    for (let i = 0; i < todo.length; i++) {
      if (shuttingDown) break;

      const symbol = todo[i];
      const url = `${BASE_URL}/v2/ord/btc/collections/${encodeURIComponent(symbol)}/attribute_stats`;

      try {
        const { status, data } = await fetchWithRetry(page, url);

        if (status === 404 || status === 400) {
          notFound++;
          progress.notFound.push(symbol);
          if (notFound <= 10) {
            log(`  [${i + 1}/${todo.length}] NOT FOUND: ${symbol} (${status})`);
          }
        } else if (status === 200 && data) {
          // attribute_stats returns an array of trait objects
          if (Array.isArray(data) && data.length > 0) {
            fs.writeFileSync(
              path.join(ATTRIBUTES_DIR, `${symbol}.json`),
              JSON.stringify(data, null, 2),
            );
            progress.completed.push(symbol);
            fetched++;

            if (fetched === 1) {
              log(`  FIRST RESULT: ${symbol} — ${data.length} traits`);
              log(`  Sample: ${JSON.stringify(data[0])}`);
            }
          } else if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0) {
            // Some collections might return an object instead of array
            fs.writeFileSync(
              path.join(ATTRIBUTES_DIR, `${symbol}.json`),
              JSON.stringify(data, null, 2),
            );
            progress.completed.push(symbol);
            fetched++;

            if (fetched === 1) {
              log(`  FIRST RESULT: ${symbol} — keys: ${Object.keys(data).join(', ')}`);
            }
          } else {
            empty++;
            progress.empty.push(symbol);
            if (empty <= 5) {
              log(`  [${i + 1}/${todo.length}] EMPTY: ${symbol}`);
            }
          }
        } else {
          empty++;
          progress.empty.push(symbol);
          if (empty <= 5) {
            log(`  [${i + 1}/${todo.length}] EMPTY (${status}): ${symbol}`);
          }
        }
      } catch (err: any) {
        if (err.message === 'SHUTDOWN') break;
        log(`  [${i + 1}/${todo.length}] ERROR: ${symbol} — ${err.message?.slice(0, 80)}`);
      }

      // Save progress after every symbol
      saveProgress(progress);

      // Progress logging every 100 collections
      if ((i + 1) % 100 === 0) {
        log(`  [${i + 1}/${todo.length}] fetched: ${fetched}, not found: ${notFound}, empty: ${empty}`);
      }

      if (DRY_RUN && i >= 5) break;
    }
  } finally {
    await browser.close();
    log('Browser closed.');
  }

  log('='.repeat(70));
  log('ATTRIBUTE STATS ARCHIVE COMPLETE');
  log(`Fetched: ${fetched} | Not found: ${notFound} | Empty: ${empty} | Total: ${todo.length}`);
  log('='.repeat(70));
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
