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
    await sleep(2500);
    const response = await client.get('/v2/ord/btc/tokens', { params });
    const tokens = response.data?.tokens || [];
    console.log(`  ${label}: ${tokens.length} tokens`);
    if (tokens.length > 0) {
      console.log(`    first: #${tokens[0].inscriptionNumber}, last: #${tokens[tokens.length - 1].inscriptionNumber}`);
    }
    return tokens.length;
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const msg = JSON.stringify(data || err.message).slice(0, 300);
    console.log(`  ${label}: ERROR ${status} — ${msg}`);
    return -1;
  }
}

async function main() {
  // Test 1: What inscriptionMax values are accepted?
  console.log('\n=== Test: inscriptionMax accepted values ===');
  console.log('Using inscriptionMin=0 (valid bucket), varying inscriptionMax\n');
  
  const maxValues = [100, 1000, 10000, 100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000, 200000000];
  for (const maxVal of maxValues) {
    await testQuery(`max=${maxVal}`, {
      collectionSymbol: 'unity', limit: 20, offset: 0,
      sortBy: 'inscriptionNumberAsc', showAll: 'true',
      inscriptionMin: 0, inscriptionMax: maxVal,
    });
  }

  // Test 2: Try with a collection that has low inscription numbers
  // "bitcoin-frogs" should be early inscriptions
  console.log('\n=== Test: bitcoin-frogs (early inscriptions) ===');
  await testQuery('no filter', {
    collectionSymbol: 'bitcoin-frogs', limit: 20, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
  });
  await testQuery('min=0, max=1000000', {
    collectionSymbol: 'bitcoin-frogs', limit: 20, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: 0, inscriptionMax: 1000000,
  });

  // Test 3: Try with bitmap (our biggest target)
  console.log('\n=== Test: bitmap (938K supply, inscriptions spread wide) ===');
  await testQuery('no filter, first page asc', {
    collectionSymbol: 'bitmap', limit: 20, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
  });
  await testQuery('no filter, first page desc', {
    collectionSymbol: 'bitmap', limit: 20, offset: 0,
    sortBy: 'inscriptionNumberDesc', showAll: 'true',
  });

  // Test 4: Alternative sort fields — maybe priceAsc/priceDesc gives different offset behavior?
  console.log('\n=== Test: Alternative sort fields ===');
  await testQuery('listedAtAsc', {
    collectionSymbol: 'unity', limit: 20, offset: 0,
    sortBy: 'listedAtAsc', showAll: 'true',
  });
  await testQuery('listedAtDesc', {
    collectionSymbol: 'unity', limit: 20, offset: 0,
    sortBy: 'listedAtDesc', showAll: 'true',
  });
  await testQuery('priceAsc', {
    collectionSymbol: 'unity', limit: 20, offset: 0,
    sortBy: 'priceAsc', showAll: 'true',
  });
  await testQuery('priceDesc', {
    collectionSymbol: 'unity', limit: 20, offset: 0,
    sortBy: 'priceDesc', showAll: 'true',
  });

  // Test 5: priceAsc at offset 10040 — does the limit apply to all sort fields?
  console.log('\n=== Test: Offset limit on different sort fields ===');
  await testQuery('priceAsc, offset=10000', {
    collectionSymbol: 'unity', limit: 20, offset: 10000,
    sortBy: 'priceAsc', showAll: 'true',
  });
  await testQuery('priceAsc, offset=10040', {
    collectionSymbol: 'unity', limit: 20, offset: 10040,
    sortBy: 'priceAsc', showAll: 'true',
  });
  await testQuery('listedAtAsc, offset=10040', {
    collectionSymbol: 'unity', limit: 20, offset: 10040,
    sortBy: 'listedAtAsc', showAll: 'true',
  });

  // Test 6: Does filtering by inscriptionMin/Max extend the offset limit?
  console.log('\n=== Test: Does windowing extend offset limit? ===');
  // Use bitmap which has lots of low-number inscriptions
  await testQuery('bitmap min=-1000000, max=100000, offset=0', {
    collectionSymbol: 'bitmap', limit: 20, offset: 0,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: -1000000, inscriptionMax: 100000,
  });
  await testQuery('bitmap min=-1000000, max=100000, offset=10000', {
    collectionSymbol: 'bitmap', limit: 20, offset: 10000,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: -1000000, inscriptionMax: 100000,
  });
  await testQuery('bitmap min=-1000000, max=100000, offset=10040', {
    collectionSymbol: 'bitmap', limit: 20, offset: 10040,
    sortBy: 'inscriptionNumberAsc', showAll: 'true',
    inscriptionMin: -1000000, inscriptionMax: 100000,
  });

  console.log('\n=== Tests complete ===');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
