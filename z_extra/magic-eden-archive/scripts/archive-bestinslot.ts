import * as path from 'path';
import * as fs from 'fs';
import axios, { AxiosInstance } from 'axios';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TOKENS_DIR = path.join(DATA_DIR, 'tokens');
const PROGRESS_FILE = path.join(DATA_DIR, 'bis-progress.json');
const LOG_FILE = path.join(DATA_DIR, 'bis-archive.log');

const BASE_DELAY_MS = 1000;
const BACKOFF_INITIAL_MS = 10_000;
const BACKOFF_MAX_MS = 300_000; // 5 minutes
const MAX_RETRIES = 20; // very resilient — laptop may sleep for hours
const ITEMS_PER_PAGE = 25; // fixed by BiS API
const FILE_SUFFIX = '.bis.ndjson';

// BiS v2 internal API — no API key needed
const BIS_BASE_URL = 'https://v2api.bestinslot.xyz';

// ME symbol → BiS slug mapping (only collections that differ)
const SLUG_MAP: Record<string, string> = {
  'btc-name': 'bitcoin-names',
};

// Wave 1: Original gap collections (all completed)
const COLLECTIONS_WAVE1: { meSymbol: string; bisSlug: string; supply: number }[] = [
  { meSymbol: 'rsic', bisSlug: 'rsic', supply: 21_000 },
  { meSymbol: 'osh', bisSlug: 'osh', supply: 21_000 },
  { meSymbol: 'prometheans', bisSlug: 'prometheans', supply: 21_000 },
  { meSymbol: 'genesis_runes', bisSlug: 'genesis_runes', supply: 22_919 },
  { meSymbol: 'buzz-buzz-buzz', bisSlug: 'buzz-buzz-buzz', supply: 23_836 },
  { meSymbol: 'btc-land', bisSlug: 'btc-land', supply: 29_481 },
  { meSymbol: 'one-of-editions', bisSlug: 'one-of-editions', supply: 35_262 },
  { meSymbol: 'the-prophecy', bisSlug: 'the-prophecy', supply: 45_000 },
  { meSymbol: 'btc-artifacts', bisSlug: 'btc-artifacts', supply: 49_739 },
  { meSymbol: 'runesambbi', bisSlug: 'runesambbi', supply: 69_690 },
  { meSymbol: 'runestone', bisSlug: 'runestone', supply: 112_384 },
  { meSymbol: 'bitmap', bisSlug: 'bitmap', supply: 938_987 },
  { meSymbol: 'btc-name', bisSlug: 'bitcoin-names', supply: 2_056_963 },
];

// Wave 2: Gap collections from validation — available on BiS but not yet scraped
const COLLECTIONS_WAVE2: { meSymbol: string; bisSlug: string; supply: number }[] = [
  { meSymbol: 'five_random_backgrounds', bisSlug: 'five_random_backgrounds', supply: 5 },
  { meSymbol: 'the-third-point', bisSlug: 'the-third-point', supply: 5 },
  { meSymbol: 'exclam-empire', bisSlug: 'exclam-empire', supply: 10 },
  { meSymbol: 'exclam-eternal', bisSlug: 'exclam-eternal', supply: 10 },
  { meSymbol: 'ten_white_backgrounds', bisSlug: 'ten_white_backgrounds', supply: 10 },
  { meSymbol: 'test_123', bisSlug: 'test_123', supply: 10 },
  { meSymbol: 'test_demo_123', bisSlug: 'test_demo_123', supply: 10 },
  { meSymbol: 'taproot_puppies', bisSlug: 'taproot_puppies', supply: 24 },
  { meSymbol: 'trump_america_first_bonus', bisSlug: 'trump_america_first_bonus', supply: 50 },
  { meSymbol: 'mcempire_pepes', bisSlug: 'mcempire_pepes', supply: 57 },
  { meSymbol: 'glitchs-army-the-generals', bisSlug: 'glitchs-army-the-generals', supply: 80 },
  { meSymbol: 'customink', bisSlug: 'customink', supply: 83 },
  { meSymbol: 'cowboy-commas', bisSlug: 'cowboy-commas', supply: 100 },
  { meSymbol: 'flippers', bisSlug: 'flippers', supply: 100 },
  { meSymbol: 'lesfleurs', bisSlug: 'lesfleurs', supply: 100 },
  { meSymbol: 'ordinaldragoons', bisSlug: 'ordinaldragoons', supply: 100 },
  { meSymbol: 'btcbozos', bisSlug: 'btcbozos', supply: 111 },
  { meSymbol: 'immutable', bisSlug: 'immutable', supply: 128 },
  { meSymbol: 'chronoblocks', bisSlug: 'chronoblocks', supply: 134 },
  { meSymbol: 'testing-testing', bisSlug: 'testing-testing', supply: 150 },
  { meSymbol: 'trump-bitcoin-trading-cards', bisSlug: 'trump-bitcoin-trading-cards', supply: 160 },
  { meSymbol: 'green_box', bisSlug: 'green_box', supply: 200 },
  { meSymbol: 'musordinals', bisSlug: 'musordinals', supply: 200 },
  { meSymbol: 'still-life-by-vinnie-hager', bisSlug: 'still-life-by-vinnie-hager', supply: 200 },
  { meSymbol: 'mutantapepunks', bisSlug: 'mutantapepunks', supply: 201 },
  { meSymbol: 'domain_dot_ai', bisSlug: 'domain_dot_ai', supply: 202 },
  { meSymbol: 'nocturnal-maxis', bisSlug: 'nocturnal-maxis', supply: 222 },
  { meSymbol: 'nftnycxjoshbyer', bisSlug: 'nftnycxjoshbyer', supply: 240 },
  { meSymbol: 'quantum_threads', bisSlug: 'quantum_threads', supply: 256 },
  { meSymbol: 'coomcaches', bisSlug: 'coomcaches', supply: 300 },
  { meSymbol: 'eggs', bisSlug: 'eggs', supply: 333 },
  { meSymbol: 'regens', bisSlug: 'regens', supply: 369 },
  { meSymbol: 'community', bisSlug: 'community', supply: 400 },
  { meSymbol: 'blockboysbtc', bisSlug: 'blockboysbtc', supply: 410 },
  { meSymbol: 'ordimaps', bisSlug: 'ordimaps', supply: 420 },
  { meSymbol: 'satoshifinneycc', bisSlug: 'satoshifinneycc', supply: 499 },
  { meSymbol: 'hats_sats_gen_2', bisSlug: 'hats_sats_gen_2', supply: 500 },
  { meSymbol: 'mbk-castles-genesis-lands', bisSlug: 'mbk-castles-genesis-lands', supply: 649 },
  { meSymbol: 'beatblock-genesis', bisSlug: 'beatblock-genesis', supply: 808 },
  { meSymbol: 'cypherpunkss', bisSlug: 'cypherpunkss', supply: 903 },
  { meSymbol: 'kingdom_act2_alchemy', bisSlug: 'kingdom_act2_alchemy', supply: 998 },
  { meSymbol: 'ox999', bisSlug: 'ox999', supply: 999 },
  { meSymbol: 'dog_of_bitcoin_szn_ii_trump', bisSlug: 'dog_of_bitcoin_szn_ii_trump', supply: 1_000 },
  { meSymbol: 'mentorsmint', bisSlug: 'mentorsmint', supply: 1_749 },
  { meSymbol: 'pizza-ninjas', bisSlug: 'pizza-ninjas', supply: 2_022 },
  { meSymbol: 'qb_goldrush', bisSlug: 'qb_goldrush', supply: 2_500 },
  { meSymbol: 'pizzaaliens', bisSlug: 'pizzaaliens', supply: 2_685 },
  { meSymbol: 'dojo', bisSlug: 'dojo', supply: 3_333 },
  { meSymbol: 'gumboworld', bisSlug: 'gumboworld', supply: 3_333 },
  { meSymbol: 'mikan', bisSlug: 'mikan', supply: 3_333 },
  { meSymbol: 'runes_keys', bisSlug: 'runes_keys', supply: 3_629 },
  { meSymbol: 'bits', bisSlug: 'bits', supply: 4_616 },
  { meSymbol: 'nakamotorunes', bisSlug: 'nakamotorunes', supply: 5_000 },
  { meSymbol: 'bitcoin-cryptodickbutts', bisSlug: 'bitcoin-cryptodickbutts', supply: 5_198 },
  { meSymbol: 'jeetsonbtc', bisSlug: 'jeetsonbtc', supply: 5_555 },
  { meSymbol: 'mr-burnz', bisSlug: 'mr-burnz', supply: 7_777 },
  { meSymbol: 'cirque-le-noir-clowns', bisSlug: 'cirque-le-noir-clowns', supply: 9_999 },
  { meSymbol: 'octoglyphs', bisSlug: 'octoglyphs', supply: 10_000 },
  { meSymbol: 'marowan', bisSlug: 'marowan', supply: 15_283 },
  { meSymbol: 'brc420-dragonball', bisSlug: 'brc420-dragonball', supply: 17_736 },
  { meSymbol: 'flyinals', bisSlug: 'flyinals', supply: 19_280 },
  { meSymbol: 'realbitamigos', bisSlug: 'realbitamigos', supply: 20_000 },
  { meSymbol: 'virothium-mine', bisSlug: 'virothium-mine', supply: 20_956 },
  { meSymbol: 'monkes21', bisSlug: 'monkes21', supply: 20_978 },
  { meSymbol: 'rabbitbrc', bisSlug: 'rabbitbrc', supply: 20_978 },
  { meSymbol: 'runers', bisSlug: 'runers', supply: 20_994 },
  { meSymbol: 'bitcointrolls', bisSlug: 'bitcointrolls', supply: 21_000 },
  { meSymbol: 'brc420_ordz_games_arcade', bisSlug: 'brc420_ordz_games_arcade', supply: 21_000 },
  { meSymbol: 'gameofducks', bisSlug: 'gameofducks', supply: 21_000 },
  { meSymbol: 'inscription-book', bisSlug: 'inscription-book', supply: 21_000 },
  { meSymbol: 'shit', bisSlug: 'shit', supply: 21_000 },
  { meSymbol: 'ordi_orccash', bisSlug: 'ordi_orccash', supply: 21_637 },
  { meSymbol: 'dmt-opcat', bisSlug: 'dmt-opcat', supply: 22_176 },
  { meSymbol: 'whispers-from-the-ancient-stone', bisSlug: 'whispers-from-the-ancient-stone', supply: 23_118 },
  { meSymbol: 'karmastone', bisSlug: 'karmastone', supply: 26_145 },
  { meSymbol: 'dmt_natdiamonds', bisSlug: 'dmt_natdiamonds', supply: 26_189 },
  { meSymbol: 'coom-battles', bisSlug: 'coom-battles', supply: 29_984 },
  { meSymbol: 'worldpeace', bisSlug: 'worldpeace', supply: 30_710 },
  { meSymbol: 'mysticrunes', bisSlug: 'mysticrunes', supply: 39_199 },
  { meSymbol: 'mineral', bisSlug: 'mineral', supply: 40_000 },
  { meSymbol: 'brc420-blue-wand', bisSlug: 'brc420-blue-wand', supply: 42_000 },
  { meSymbol: 'blockbrc', bisSlug: 'blockbrc', supply: 42_069 },
  { meSymbol: 'liquid', bisSlug: 'liquid', supply: 49_998 },
  { meSymbol: 'wzrds', bisSlug: 'wzrds', supply: 61_139 },
  { meSymbol: 'btc-survival-gear', bisSlug: 'btc-survival-gear', supply: 92_000 },
  { meSymbol: 'forever-bullish', bisSlug: 'forever-bullish', supply: 225_459 },
];

const COLLECTIONS = [...COLLECTIONS_WAVE1, ...COLLECTIONS_WAVE2];

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_MEDIUM = process.argv.includes('--only-medium'); // skip bitmap + btc-name

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
// Progress tracking — survives crashes, laptop sleep, restarts
// ---------------------------------------------------------------------------

interface BisProgress {
  completed: string[];  // meSymbol list
  inProgress: {
    meSymbol: string;
    bisSlug: string;
    page: number;        // last successfully written page
    itemCount: number;   // total items written so far
  } | null;
  failed: string[];
}

function loadProgress(): BisProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { completed: [], inProgress: null, failed: [] };
}

function saveProgress(progress: BisProgress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// HTTP client with retry + exponential backoff
// ---------------------------------------------------------------------------

const client: AxiosInstance = axios.create({
  baseURL: BIS_BASE_URL,
  timeout: 30_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) cubes-archiver/1.0',
    'Accept': 'application/json',
  },
});

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface BisItem {
  id: number;
  slug: string;
  inscription_number: number;
  last_sale: number | null;
  inscription_id: string;
  wallet: string;
  content_type: string;
  item_name: string;
  is_recursive: boolean;
  min_price: number | null;
  delegate: string | null;
  inscription_name: string;
}

interface BisPageResponse {
  items: BisItem[];
  page: number;
  per_page: number;
}

async function fetchPage(slug: string, page: number): Promise<BisPageResponse> {
  let lastError: Error | null = null;
  let backoff = BACKOFF_INITIAL_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (shuttingDown) throw new Error('SHUTDOWN');

    try {
      const resp = await client.get<BisPageResponse>('/collection/items', {
        params: { slug, page },
      });
      return resp.data;
    } catch (err: any) {
      lastError = err;
      const status = err?.response?.status;

      if (status === 429) {
        log(`  [429] Rate limited on page ${page}. Backing off ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      if (status === 404) {
        // Collection doesn't exist — return empty
        return { items: [], page, per_page: ITEMS_PER_PAGE };
      }

      // Network errors (ECONNRESET, ETIMEDOUT, etc.) — laptop might have slept
      const isNetworkError = !status || err.code === 'ECONNABORTED' || err.code === 'ECONNRESET'
        || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN';

      if (isNetworkError) {
        log(`  [Network error: ${err.code || err.message}] page ${page}. Waiting ${backoff / 1000}s then retrying (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        continue;
      }

      // Other HTTP errors — retry with backoff
      log(`  [HTTP ${status}] page ${page}: ${err.message}. Retrying in ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
    }
  }

  throw lastError || new Error(`Failed after ${MAX_RETRIES} retries`);
}

// ---------------------------------------------------------------------------
// Archiving a single collection
// ---------------------------------------------------------------------------

async function archiveCollection(
  meSymbol: string,
  bisSlug: string,
  supply: number,
  progress: BisProgress,
): Promise<'done' | 'shutdown'> {
  const filePath = path.join(TOKENS_DIR, `${meSymbol}${FILE_SUFFIX}`);
  const estimatedPages = Math.ceil(supply / ITEMS_PER_PAGE);

  // Determine starting page from progress
  let startPage = 1;
  let totalItems = 0;

  if (progress.inProgress?.meSymbol === meSymbol) {
    startPage = progress.inProgress.page + 1;
    totalItems = progress.inProgress.itemCount;
    log(`Resuming ${meSymbol} (${bisSlug}) from page ${startPage} (${totalItems} items so far)`);
  } else {
    // Starting fresh — truncate any existing file
    if (fs.existsSync(filePath)) {
      // Check if we have a partial file from a previous interrupted run
      // If progress says inProgress for a different collection, this file is stale
      fs.unlinkSync(filePath);
    }
    log(`Starting ${meSymbol} (${bisSlug}) — estimated ${supply.toLocaleString()} items, ~${estimatedPages.toLocaleString()} pages`);
    progress.inProgress = { meSymbol, bisSlug, page: 0, itemCount: 0 };
    saveProgress(progress);
  }

  let consecutiveEmpty = 0;
  const fd = fs.openSync(filePath, 'a'); // append mode — safe for resume

  try {
    for (let page = startPage; ; page++) {
      if (shuttingDown) {
        log(`Shutdown requested at ${meSymbol} page ${page}. Progress saved.`);
        return 'shutdown';
      }

      const data = await fetchPage(bisSlug, page);

      if (!data.items || data.items.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 3) {
          // Confirmed end of collection
          break;
        }
        // Could be a transient gap — try next page
        log(`  Page ${page}: empty (${consecutiveEmpty}/3 consecutive empties)`);
        await sleep(BASE_DELAY_MS);
        continue;
      }

      consecutiveEmpty = 0;

      // Write items as NDJSON
      for (const item of data.items) {
        fs.writeSync(fd, JSON.stringify(item) + '\n');
      }

      totalItems += data.items.length;

      // Update progress after every page
      progress.inProgress = { meSymbol, bisSlug, page, itemCount: totalItems };
      saveProgress(progress);

      // Progress logging
      const pct = supply > 0 ? ((totalItems / supply) * 100).toFixed(1) : '?';
      if (page % 100 === 0 || page === startPage) {
        log(`  ${meSymbol} page ${page}: ${totalItems.toLocaleString()} items (${pct}% of ${supply.toLocaleString()})`);
      }

      await sleep(BASE_DELAY_MS);
    }
  } finally {
    fs.closeSync(fd);
  }

  log(`Completed ${meSymbol}: ${totalItems.toLocaleString()} items archived`);
  return 'done';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log('='.repeat(70));
  log('Best in Slot Archive Script');
  log(`Data dir: ${DATA_DIR}`);
  log(`Delay: ${BASE_DELAY_MS}ms | Max retries: ${MAX_RETRIES} | Dry run: ${DRY_RUN}`);
  if (ONLY_MEDIUM) log('Mode: --only-medium (skipping bitmap + btc-name)');
  log('='.repeat(70));

  // Ensure directories exist
  fs.mkdirSync(TOKENS_DIR, { recursive: true });

  const progress = loadProgress();
  log(`Progress: ${progress.completed.length} completed, ${progress.failed.length} failed`);
  if (progress.inProgress) {
    log(`Resuming in-progress: ${progress.inProgress.meSymbol} at page ${progress.inProgress.page}`);
  }

  let collectionsToProcess = COLLECTIONS;
  if (ONLY_MEDIUM) {
    collectionsToProcess = COLLECTIONS.filter(c => c.meSymbol !== 'bitmap' && c.meSymbol !== 'btc-name');
  }
  if (DRY_RUN) {
    collectionsToProcess = collectionsToProcess.slice(0, 2);
  }

  for (const { meSymbol, bisSlug, supply } of collectionsToProcess) {
    if (shuttingDown) break;

    // Skip completed collections
    if (progress.completed.includes(meSymbol)) {
      log(`Skipping ${meSymbol} — already completed`);
      continue;
    }

    // If there's an in-progress collection that isn't this one, we need to
    // process it first (it was interrupted) — but only if it comes before
    // this one in the list or IS this one
    if (progress.inProgress && progress.inProgress.meSymbol !== meSymbol) {
      // Check if the in-progress collection is still in our todo list
      const inProgressIdx = collectionsToProcess.findIndex(c => c.meSymbol === progress.inProgress!.meSymbol);
      const currentIdx = collectionsToProcess.findIndex(c => c.meSymbol === meSymbol);
      if (inProgressIdx >= 0 && inProgressIdx > currentIdx) {
        // The in-progress one comes later — skip to this one
      } else if (inProgressIdx >= 0 && inProgressIdx < currentIdx) {
        // The in-progress one comes earlier — it should have been processed already
        continue;
      }
    }

    try {
      const result = await archiveCollection(meSymbol, bisSlug, supply, progress);

      if (result === 'shutdown') {
        saveProgress(progress);
        break;
      }

      // Mark completed
      progress.completed.push(meSymbol);
      progress.inProgress = null;
      saveProgress(progress);

    } catch (err: any) {
      if (err.message === 'SHUTDOWN') {
        saveProgress(progress);
        break;
      }
      log(`FAILED ${meSymbol}: ${err.message}`);
      progress.failed.push(meSymbol);
      progress.inProgress = null;
      saveProgress(progress);
    }
  }

  // Final summary
  log('='.repeat(70));
  log('ARCHIVE COMPLETE');
  log(`Completed: ${progress.completed.length} collections`);
  log(`Failed: ${progress.failed.length} collections${progress.failed.length ? ': ' + progress.failed.join(', ') : ''}`);
  if (progress.inProgress) {
    log(`In progress (interrupted): ${progress.inProgress.meSymbol} at page ${progress.inProgress.page}`);
  }
  log('='.repeat(70));
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
