import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// Load .env
const envPath = path.join(PROJECT_ROOT, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
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

const apiKey = process.env.MAGIC_EDEN_API_KEY!;
const client = axios.create({
  baseURL: 'https://api-mainnet.magiceden.dev',
  headers: { accept: 'application/json', Authorization: `Bearer ${apiKey}` },
  timeout: 30_000,
});

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function testQuery(label: string, params: Record<string, any>) {
  try {
    await sleep(2500); // safe rate limit
    const response = await client.get('/v2/ord/btc/tokens', { params });
    const tokens = response.data?.tokens || [];
    const total = response.data?.total;
    console.log(`  ${label}: ${tokens.length} tokens returned, total=${total}`);
    if (tokens.length > 0) {
      const first = tokens[0];
      const last = tokens[tokens.length - 1];
      console.log(`    first inscriptionNumber: ${first.inscriptionNumber}, last: ${last.inscriptionNumber}`);
    }
    return { ok: true, count: tokens.length, total };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.log(`  ${label}: ERROR ${status} — ${JSON.stringify(data || err.message).slice(0, 200)}`);
    return { ok: false, count: 0, total: 0 };
  }
}

async function main() {
  // Test collection: "unity" (supply 20,000) — small enough to be manageable, large enough to have a gap
  const symbol = 'unity';
  console.log(`\n=== Testing inscriptionMin/Max on "${symbol}" (supply: 20,000) ===\n`);

  // Known bucket values from previous testing:
  // -1000000, -500000, -100000, -10000, -5000, -1000, 0, 100, 1000, 10000, 100000
  
  // Test 1: Basic inscriptionMin without inscriptionMax
  console.log('--- Test 1: inscriptionMin only ---');
  await testQuery('inscriptionMin=0', {
    collectionSymbol: symbol, limit: 40, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 0,
  });
  await testQuery('inscriptionMin=10000', {
    collectionSymbol: symbol, limit: 40, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 10000,
  });
  await testQuery('inscriptionMin=100000', {
    collectionSymbol: symbol, limit: 40, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 100000,
  });

  // Test 2: inscriptionMax only
  console.log('\n--- Test 2: inscriptionMax only ---');
  await testQuery('inscriptionMax=100000', {
    collectionSymbol: symbol, limit: 40, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMax: 100000,
  });
  await testQuery('inscriptionMax=10000', {
    collectionSymbol: symbol, limit: 40, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMax: 10000,
  });

  // Test 3: Both min and max (window)
  console.log('\n--- Test 3: inscriptionMin + inscriptionMax (windows) ---');
  await testQuery('min=0, max=10000', {
    collectionSymbol: symbol, limit: 40, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 0, inscriptionMax: 10000,
  });
  await testQuery('min=10000, max=100000', {
    collectionSymbol: symbol, limit: 40, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 10000, inscriptionMax: 100000,
  });

  // Test 4: Does offset limit still apply within a window?
  console.log('\n--- Test 4: Offset near limit within a window ---');
  await testQuery('min=0, max=100000, offset=10000', {
    collectionSymbol: symbol, limit: 40, offset: 10000,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 0, inscriptionMax: 100000,
  });
  await testQuery('min=0, max=100000, offset=10040', {
    collectionSymbol: symbol, limit: 40, offset: 10040,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 0, inscriptionMax: 100000,
  });

  // Test 5: Try non-bucket values (should fail with 400?)
  console.log('\n--- Test 5: Non-bucket inscriptionMin values ---');
  await testQuery('inscriptionMin=5000 (non-bucket)', {
    collectionSymbol: symbol, limit: 40, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 5000,
  });
  await testQuery('inscriptionMin=50000 (non-bucket)', {
    collectionSymbol: symbol, limit: 40, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 50000,
  });

  // Test 6: Negative bucket values
  console.log('\n--- Test 6: Negative inscriptionMin ---');
  await testQuery('inscriptionMin=-1000', {
    collectionSymbol: symbol, limit: 40, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: -1000,
  });

  // Test 7: Check total field — does it reflect the window or the whole collection?
  console.log('\n--- Test 7: Does "total" reflect the window? ---');
  await testQuery('no filter', {
    collectionSymbol: symbol, limit: 1, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
  });
  await testQuery('min=0, max=10000', {
    collectionSymbol: symbol, limit: 1, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 0, inscriptionMax: 10000,
  });
  await testQuery('min=10000, max=100000', {
    collectionSymbol: symbol, limit: 1, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 10000, inscriptionMax: 100000,
  });

  console.log('\n=== Tests complete ===');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
