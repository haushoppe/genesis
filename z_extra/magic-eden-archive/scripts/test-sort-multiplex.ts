import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const envPath = path.join(PROJECT_ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const client = axios.create({
  baseURL: 'https://api-mainnet.magiceden.dev',
  headers: { accept: 'application/json', Authorization: `Bearer ${process.env.MAGIC_EDEN_API_KEY}` },
  timeout: 30_000,
});

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Fetch first N tokens with a given sort, collecting unique IDs
 */
async function fetchFirstN(symbol: string, sortBy: string, n: number): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset = 0;
  while (ids.size < n) {
    await sleep(2500);
    try {
      const resp = await client.get('/v2/ord/btc/tokens', {
        params: { collectionSymbol: symbol, limit: 100, offset, sortBy, showAll: 'true' }
      });
      const tokens = resp.data?.tokens || [];
      if (tokens.length === 0) break;
      for (const t of tokens) ids.add(t.id);
      offset += 100;
      if (offset >= 10040) break;
    } catch (err: any) {
      if (err?.response?.status === 400) break;
      throw err;
    }
  }
  return ids;
}

async function main() {
  // Test with "unity" (supply 20,000) — we know it has a ~920 token gap
  // Only fetch first 500 tokens from each sort to quickly estimate overlap
  const symbol = 'unity';
  const sampleSize = 500;
  
  console.log(`\n=== Sort Field Multiplexing Test on "${symbol}" (supply: 20,000) ===`);
  console.log(`Fetching first ${sampleSize} tokens from each sort direction...\n`);

  const sortFields = [
    'inscriptionNumberAsc',
    'inscriptionNumberDesc',
    'priceAsc',
    'priceDesc',
    'listedAtAsc',
    'listedAtDesc',
  ];

  const sets: Record<string, Set<string>> = {};
  const combined = new Set<string>();

  for (const sort of sortFields) {
    console.log(`Fetching ${sort}...`);
    sets[sort] = await fetchFirstN(symbol, sort, sampleSize);
    const sizeBefore = combined.size;
    for (const id of sets[sort]) combined.add(id);
    const newUnique = combined.size - sizeBefore;
    console.log(`  Got ${sets[sort].size} tokens, ${newUnique} new unique (total unique: ${combined.size})\n`);
  }

  // Cross-compare overlaps
  console.log('--- Overlap Matrix (first 500 tokens each) ---');
  for (let i = 0; i < sortFields.length; i++) {
    for (let j = i + 1; j < sortFields.length; j++) {
      const a = sets[sortFields[i]];
      const b = sets[sortFields[j]];
      let overlap = 0;
      for (const id of a) { if (b.has(id)) overlap++; }
      const overlapPct = (overlap / Math.min(a.size, b.size) * 100).toFixed(1);
      console.log(`  ${sortFields[i].padEnd(25)} ∩ ${sortFields[j].padEnd(25)} = ${overlap} (${overlapPct}%)`);
    }
  }

  console.log(`\nTotal unique tokens across all sort fields: ${combined.size}`);
  console.log(`Coverage: ${(combined.size / 20000 * 100).toFixed(1)}% of supply\n`);

  // Now let's check: for inscription number sort, where does the GAP start/end?
  console.log('--- Checking gap boundaries ---');
  const ascIds = await fetchFirstN(symbol, 'inscriptionNumberAsc', 10040);
  console.log(`inscriptionNumberAsc full run: ${ascIds.size} tokens`);
  const descIds = await fetchFirstN(symbol, 'inscriptionNumberDesc', 10040);
  console.log(`inscriptionNumberDesc full run: ${descIds.size} tokens`);
  
  // Combine all
  for (const id of ascIds) combined.add(id);
  for (const id of descIds) combined.add(id);
  
  // Now add price sorts (full 10K each)  
  console.log('\nFetching priceAsc full (10040)...');
  const priceAscFull = await fetchFirstN(symbol, 'priceAsc', 10040);
  const beforePrice = combined.size;
  for (const id of priceAscFull) combined.add(id);
  console.log(`  priceAsc: ${priceAscFull.size} tokens, ${combined.size - beforePrice} new unique`);

  console.log('Fetching priceDesc full (10040)...');
  const priceDescFull = await fetchFirstN(symbol, 'priceDesc', 10040);
  const beforePriceDesc = combined.size;
  for (const id of priceDescFull) combined.add(id);
  console.log(`  priceDesc: ${priceDescFull.size} tokens, ${combined.size - beforePriceDesc} new unique`);

  console.log(`\nFINAL: ${combined.size} unique tokens out of 20,000 supply = ${(combined.size / 20000 * 100).toFixed(1)}%`);
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
