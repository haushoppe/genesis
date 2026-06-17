import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as readline from 'readline';

// ---------------------------------------------------------------------------
// Builds the slim public archive consumed by cubes.haushoppe.art and friends.
//
// Input  (read-only):
//   z_extra/magic-eden-archive/data/tokens/{symbol}.ndjson
//   z_extra/magic-eden-archive/data/collections/{symbol}.json
//   z_extra/magic-eden-archive/data/collection-stats/{symbol}.json
//
// Output (written):
//   {OUTPUT_DIR}/index.csv                        — symbol,name,totalVolume (ranked)
//   {OUTPUT_DIR}/inscriptions/{symbol}.csv.gz     — id,contentType for every token
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TOKENS_DIR = path.join(DATA_DIR, 'tokens');
const COLLECTIONS_DIR = path.join(DATA_DIR, 'collections');
const STATS_DIR = path.join(DATA_DIR, 'collection-stats');

const OUTPUT_DIR = '/Users/user/Work/ordpool/magic-eden-ordinals-archive';
const INSCRIPTIONS_DIR = path.join(OUTPUT_DIR, 'inscriptions');

const DRY_RUN = process.argv.includes('--dry-run');

// ME meta-collections — these group tokens by intrinsic sat/inscription properties,
// not by minting origin. Their ndjson files contain wallet snapshots polluted with
// unrelated tokens (0% match collectionSymbol). Excluded entirely from the archive.
const META_COLLECTIONS = new Set([
  'uncommons',
  'black-uncommons',
  'sub-100k',
  'sub-10k',
  'sub-1k',
  'sub-100',
]);

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ---------------------------------------------------------------------------
// CSV escaping (RFC 4180)
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function readJsonSafe(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function getCollectionName(symbol: string): string {
  const data = readJsonSafe(path.join(COLLECTIONS_DIR, `${symbol}.json`));
  if (!data || data._placeholder) return '';
  return typeof data.name === 'string' ? data.name : '';
}

function getTotalVolume(symbol: string): number {
  const data = readJsonSafe(path.join(STATS_DIR, `${symbol}.json`));
  if (!data) return 0;
  const v = data.totalVolume;
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Per-collection processing
// ---------------------------------------------------------------------------

async function buildCollectionCsv(symbol: string): Promise<{ kept: number; dropped: number }> {
  const inputPath = path.join(TOKENS_DIR, `${symbol}.ndjson`);
  const outputPath = path.join(INSCRIPTIONS_DIR, `${symbol}.csv.gz`);

  const chunks: string[] = ['id,contentType\n'];
  let kept = 0;
  let dropped = 0;       // tokens whose collectionSymbol doesn't match — meta-collection pollution
  let skippedLines = 0;  // malformed lines (parse errors, missing id)

  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const t = JSON.parse(trimmed);
      const id = t.id;
      if (typeof id !== 'string' || !id) {
        skippedLines++;
        continue;
      }
      // Reject pollution: meta-collections (uncommons, sub-100k, etc.) store wallet
      // snapshots that include tokens from OTHER collections. Filter strictly so
      // each output CSV contains only inscriptions that actually belong here.
      const ownSymbol = t.collectionSymbol;
      if (typeof ownSymbol === 'string' && ownSymbol !== symbol) {
        dropped++;
        continue;
      }
      const contentType = t.contentType ?? '';
      // id is `<64 hex>i<int>`, contentType is `image/png` etc. — both comma-safe.
      chunks.push(`${id},${String(contentType)}\n`);
      kept++;
    } catch {
      skippedLines++;
    }
  }

  if (skippedLines > 0) {
    log(`  WARN ${symbol}: skipped ${skippedLines} malformed lines`);
  }
  if (dropped > 0) {
    log(`  ${symbol}: dropped ${dropped.toLocaleString()} polluted tokens (kept ${kept.toLocaleString()})`);
  }

  // Don't write empty CSVs (meta-collections will have 0 kept).
  if (!DRY_RUN && kept > 0) {
    const buffer = Buffer.from(chunks.join(''));
    const gzipped = zlib.gzipSync(buffer, { level: 9 });
    fs.writeFileSync(outputPath, gzipped);
  }

  return { kept, dropped };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface IndexEntry {
  symbol: string;
  name: string;
  totalVolume: number;
  tokenCount: number;
}

async function main() {
  log('='.repeat(70));
  log('Build Public Archive');
  log(`Input:  ${DATA_DIR}`);
  log(`Output: ${OUTPUT_DIR}`);
  log(`Dry run: ${DRY_RUN}`);
  log('='.repeat(70));

  if (!DRY_RUN) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(INSCRIPTIONS_DIR, { recursive: true });
  }

  // Collect all token files (exclude BiS variants — those are a separate dataset)
  const allTokenFiles = fs.readdirSync(TOKENS_DIR)
    .filter(f => f.endsWith('.ndjson') && !f.endsWith('.bis.ndjson'))
    .sort();

  // Drop the 6 ME meta-collections — they're polluted by design (see comment above).
  const tokenFiles = allTokenFiles.filter(f => !META_COLLECTIONS.has(f.replace('.ndjson', '')));
  const excludedMeta = allTokenFiles.length - tokenFiles.length;

  log(`Found ${allTokenFiles.length} token files (${excludedMeta} meta-collections excluded, ${tokenFiles.length} to process)`);

  const entries: IndexEntry[] = [];
  const emptyCollections: string[] = [];   // unexpected zero-token collections — surfaces in summary
  const startTime = Date.now();

  for (let i = 0; i < tokenFiles.length; i++) {
    const file = tokenFiles[i];
    const symbol = file.replace('.ndjson', '');

    const name = getCollectionName(symbol);
    const totalVolume = getTotalVolume(symbol);
    const { kept } = await buildCollectionCsv(symbol);

    if (kept === 0) {
      emptyCollections.push(symbol);
    } else {
      entries.push({ symbol, name, totalVolume, tokenCount: kept });
    }

    if ((i + 1) % 100 === 0 || i === tokenFiles.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const eta = (tokenFiles.length - i - 1) / rate;
      log(`  [${i + 1}/${tokenFiles.length}] elapsed=${elapsed.toFixed(0)}s rate=${rate.toFixed(1)}/s eta=${eta.toFixed(0)}s`);
    }
  }

  // Sort by totalVolume desc — ties broken by token count, then symbol
  entries.sort((a, b) => {
    if (b.totalVolume !== a.totalVolume) return b.totalVolume - a.totalVolume;
    if (b.tokenCount !== a.tokenCount) return b.tokenCount - a.tokenCount;
    return a.symbol.localeCompare(b.symbol);
  });

  // Write index.csv
  const indexLines = ['symbol,name,totalVolume'];
  for (const e of entries) {
    indexLines.push(`${csvEscape(e.symbol)},${csvEscape(e.name)},${e.totalVolume}`);
  }
  const indexContent = indexLines.join('\n') + '\n';

  if (!DRY_RUN) {
    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.csv'), indexContent);
  }

  // Summary
  const totalTokens = entries.reduce((acc, e) => acc + e.tokenCount, 0);
  const withName = entries.filter(e => e.name).length;
  const withVolume = entries.filter(e => e.totalVolume > 0).length;

  log('='.repeat(70));
  log('SUMMARY');
  log(`  Source token files:        ${tokenFiles.length}`);
  log(`  Excluded meta-collections: ${excludedMeta}  (${[...META_COLLECTIONS].join(', ')})`);
  log(`  Collections in index:      ${entries.length}`);
  log(`    with name:               ${withName}`);
  log(`    with totalVolume:        ${withVolume}`);
  log(`  Empty (unexpected):        ${emptyCollections.length}`);
  if (emptyCollections.length > 0) {
    log(`    ${emptyCollections.join(', ')}`);
  }
  log(`  Total tokens written:      ${totalTokens.toLocaleString()}`);
  log('='.repeat(70));
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
