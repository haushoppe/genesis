import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TOKENS_DIR = path.join(DATA_DIR, 'tokens');
const CSV_FILE = path.resolve(__dirname, '..', 'magic-eden-data-dump', 'collection_name_traits.csv');
const DISPUTES_DIR = path.join(DATA_DIR, 'csv-disputes');
const PROGRESS_FILE = path.join(DATA_DIR, 'me-csv-fill-progress.json');
const LOG_FILE = path.join(DATA_DIR, 'me-csv-fill.log');

const DELAY_MIN_MS = 100;
const DELAY_MAX_MS = 2000;
const DELAY_COOLDOWN_FACTOR = 1.5;
const DELAY_WARMUP_REQUESTS = 50;
const DELAY_WARMUP_FACTOR = 0.9;
const BACKOFF_INITIAL_MS = 30_000;
const BACKOFF_MAX_MS = 300_000;
const MAX_RETRIES = 10;
const BATCH_SIZE = 20; // ME API max for tokenIds parameter

let currentDelay = DELAY_MIN_MS;
let okSinceLastAdjust = 0;

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

interface CsvFillProgress {
  completed: string[];      // fully processed collections
  inProgress?: {            // partially processed collection
    symbol: string;
    fetchedIds: string[];   // IDs already fetched this run
  };
}

function loadProgress(): CsvFillProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { completed: [] };
}

function saveProgress(progress: CsvFillProgress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

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
// Load existing IDs from ndjson (single pass)
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
    } catch { /* skip */ }
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Parse CSV to get IDs per collection
// ---------------------------------------------------------------------------

async function loadCsvIds(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();

  const stream = fs.createReadStream(CSV_FILE, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let first = true;
  let lineCount = 0;
  for await (const line of rl) {
    if (first) { first = false; continue; } // skip header
    lineCount++;

    // CSV format: collectionSymbol,id,name,traits
    // Split on first comma only to get symbol, then second comma for id
    const firstComma = line.indexOf(',');
    if (firstComma === -1) continue;
    const symbol = line.slice(0, firstComma).trim();
    const rest = line.slice(firstComma + 1);
    const secondComma = rest.indexOf(',');
    const id = secondComma === -1 ? rest.trim() : rest.slice(0, secondComma).trim();

    if (!symbol || !id || !id.endsWith('i0')) continue;

    let arr = map.get(symbol);
    if (!arr) {
      arr = [];
      map.set(symbol, arr);
    }
    arr.push(id);

    if (lineCount % 2_000_000 === 0) {
      log(`  CSV: ${(lineCount / 1_000_000).toFixed(1)}M lines, ${map.size} collections`);
    }
  }

  log(`  CSV loaded: ${lineCount.toLocaleString()} lines, ${map.size} collections`);
  return map;
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

  if (!fs.existsSync(CSV_FILE)) {
    log(`FATAL: CSV file not found: ${CSV_FILE}`);
    process.exit(1);
  }

  fs.mkdirSync(TOKENS_DIR, { recursive: true });
  fs.mkdirSync(DISPUTES_DIR, { recursive: true });

  const client = axios.create({
    baseURL: 'https://api-mainnet.magiceden.dev',
    timeout: 30_000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const progress = loadProgress();
  const completedSet = new Set(progress.completed);

  // Step 1: Parse CSV
  log('Loading CSV...');
  const csvIds = await loadCsvIds();

  // Step 2: Build work list — collections where CSV has more tokens than our ndjson
  interface WorkItem {
    symbol: string;
    csvCount: number;
    gap: number;
  }

  const workList: WorkItem[] = [];

  for (const [symbol, ids] of csvIds.entries()) {
    if (completedSet.has(symbol)) continue;

    const sanitized = sanitizeFilename(symbol);
    const filePath = path.join(TOKENS_DIR, `${sanitized}.ndjson`);

    // Estimate line count without loading entire file into memory
    let lineCount = 0;
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.size > 0) {
        // Rough estimate: ~500 bytes per ndjson line (conservative)
        // Will be refined when we actually load IDs later
        lineCount = Math.round(stat.size / 500);
      }
    }

    // Be generous — only include if CSV has at least 10% more than our estimate
    const gap = ids.length - lineCount;
    if (gap <= 0) continue;

    workList.push({ symbol, csvCount: ids.length, gap });
  }

  // Sort: smallest gaps first (maximize breadth, complete small collections quickly)
  workList.sort((a, b) => a.gap - b.gap);

  const totalGap = workList.reduce((sum, w) => sum + w.gap, 0);
  const totalRequests = Math.ceil(totalGap / BATCH_SIZE);

  log('='.repeat(70));
  log('ME CSV Gap Filler — tokenIds batch lookup');
  log(`Collections with gaps: ${workList.length} | Total missing tokens: ${totalGap.toLocaleString()}`);
  log(`Batch size: ${BATCH_SIZE} | Est. requests: ${totalRequests.toLocaleString()}`);
  log(`Delay: adaptive ${DELAY_MIN_MS}-${DELAY_MAX_MS}ms | Dry run: ${DRY_RUN}`);
  log(`Completed (skipped): ${completedSet.size}`);
  log('='.repeat(70));

  if (workList.length === 0) {
    log('Nothing to do!');
    return;
  }

  let totalFetched = 0;
  let totalEmpty = 0;
  let collectionsProcessed = 0;
  let apiCalls = 0;

  for (const work of workList) {
    if (shuttingDown) break;

    const { symbol, csvCount, gap } = work;
    const sanitized = sanitizeFilename(symbol);
    const filePath = path.join(TOKENS_DIR, `${sanitized}.ndjson`);

    collectionsProcessed++;

    // Load existing IDs from ndjson
    const existingIds = await loadExistingIds(filePath);

    // Also load IDs from in-progress state if resuming this collection
    const resumeIds = new Set<string>();
    if (progress.inProgress?.symbol === symbol) {
      for (const id of progress.inProgress.fetchedIds) {
        resumeIds.add(id);
      }
    }

    // Find missing IDs: in CSV but not in ndjson and not already fetched
    const csvIdsForSymbol = csvIds.get(symbol) || [];
    const missingIds = csvIdsForSymbol.filter(id =>
      !existingIds.has(id) && !resumeIds.has(id)
    );

    if (missingIds.length === 0) {
      progress.completed.push(symbol);
      progress.inProgress = undefined;
      saveProgress(progress);
      continue;
    }

    log(`  [${collectionsProcessed}/${workList.length}] "${symbol}": ${existingIds.size.toLocaleString()} existing, ${missingIds.length.toLocaleString()} missing (CSV: ${csvCount.toLocaleString()})`);

    let collFetched = 0;
    let collEmpty = 0;
    const disputedIds: string[] = []; // IDs from CSV that ME API can't confirm
    const fetchedThisRun: string[] = progress.inProgress?.symbol === symbol
      ? [...progress.inProgress.fetchedIds]
      : [];

    // Process in batches of BATCH_SIZE
    for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
      if (shuttingDown) break;

      const batch = missingIds.slice(i, i + BATCH_SIZE);
      const tokenIds = batch.join(',');

      try {
        const response = await rateLimitedGet<any>(client, '/v2/ord/btc/tokens', { tokenIds });
        apiCalls++;

        const tokens = response.tokens || [];

        if (tokens.length > 0) {
          // Deduplicate against existing IDs (safety)
          const newTokens = tokens.filter((t: any) => !existingIds.has(t.id));
          if (newTokens.length > 0) {
            fs.appendFileSync(filePath, newTokens.map((t: any) => JSON.stringify(t)).join('\n') + '\n');
            for (const t of newTokens) {
              existingIds.add(t.id);
              fetchedThisRun.push(t.id);
            }
            collFetched += newTokens.length;
          }
        }

        // Track IDs that returned nothing — disputed (CSV claims, ME can't confirm)
        const returnedIds = new Set(tokens.map((t: any) => t.id));
        for (const id of batch) {
          if (!returnedIds.has(id)) {
            collEmpty++;
            disputedIds.push(id);
            fetchedThisRun.push(id); // mark as attempted
          }
        }
      } catch (err: any) {
        if (err.message === 'SHUTDOWN') break;
        const status = err?.response?.status;
        log(`    Batch error at offset ${i}: ${status || err.code || err.message}`);
        // Don't break — skip this batch and continue
        continue;
      }

      // Progress logging every 100 batches
      if (apiCalls % 100 === 0) {
        log(`    [${i + batch.length}/${missingIds.length}] +${collFetched} fetched, ${collEmpty} empty, delay: ${currentDelay}ms, total API: ${apiCalls.toLocaleString()}`);
      }

      // Save in-progress state every 500 batches
      if (apiCalls % 500 === 0) {
        progress.inProgress = { symbol, fetchedIds: fetchedThisRun };
        saveProgress(progress);
      }

      if (DRY_RUN && apiCalls >= 10) break;
    }

    totalFetched += collFetched;
    totalEmpty += collEmpty;

    // Save disputed IDs (in CSV but not on ME API) for later investigation
    if (disputedIds.length > 0) {
      const disputeFile = path.join(DISPUTES_DIR, `${sanitized}.txt`);
      fs.writeFileSync(disputeFile, disputedIds.join('\n') + '\n');
      log(`    Disputes: ${disputedIds.length} IDs saved to csv-disputes/${sanitized}.txt`);
    }

    const newTotal = existingIds.size;
    const pct = csvCount > 0 ? ((newTotal / csvCount) * 100).toFixed(1) : '?';
    log(`    Done: +${collFetched.toLocaleString()} fetched, ${collEmpty.toLocaleString()} disputed → ${newTotal.toLocaleString()} (${pct}% of CSV ${csvCount.toLocaleString()})`);

    progress.completed.push(symbol);
    progress.inProgress = undefined;
    saveProgress(progress);

    if (DRY_RUN && collectionsProcessed >= 3) break;
  }

  log('='.repeat(70));
  log('CSV GAP FILL COMPLETE');
  log(`Collections: ${collectionsProcessed} | Fetched: ${totalFetched.toLocaleString()} | Empty: ${totalEmpty.toLocaleString()} | API calls: ${apiCalls.toLocaleString()}`);
  log('='.repeat(70));
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
