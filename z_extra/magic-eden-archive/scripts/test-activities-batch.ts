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

const apiKey = process.env.MAGIC_EDEN_API_KEY!;
const client = axios.create({
  baseURL: 'https://api-mainnet.magiceden.dev',
  headers: { accept: 'application/json', Authorization: `Bearer ${apiKey}` },
  timeout: 30_000,
});

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Test 1: Activities endpoint with different "kind" values
  console.log('=== Activities endpoint ===\n');
  const kinds = ['buying_broadcasted', 'listing', 'offer_accepted', 'transfer', 'offer_placed', ''];

  for (const kind of kinds) {
    await sleep(3000);
    try {
      const params: any = { collectionSymbol: 'bitmap', limit: 20 };
      if (kind) params.kind = kind;
      const resp = await client.get('/v2/ord/btc/activities', { params });
      const data = resp.data;
      if (Array.isArray(data)) {
        console.log(`kind="${kind}": ${data.length} activities`);
        if (data.length > 0) {
          console.log(`  keys: ${Object.keys(data[0]).join(', ')}`);
          console.log(`  sample: ${JSON.stringify(data[0]).slice(0, 250)}`);
          // Check for pagination info
          console.log(`  last tokenId: ${data[data.length - 1].tokenId || data[data.length - 1].tokenInscriptionNumber || '?'}`);
        }
      } else if (typeof data === 'object') {
        console.log(`kind="${kind}": object — keys: ${Object.keys(data).join(', ')}`);
        // Check for cursor/continuation/pagination
        for (const k of ['cursor', 'continuation', 'next', 'nextPage', 'total', 'hasMore', 'activities']) {
          if (data[k] !== undefined) console.log(`  ${k}: ${JSON.stringify(data[k]).slice(0, 200)}`);
        }
      }
    } catch (err: any) {
      console.log(`kind="${kind}": ERROR ${err?.response?.status} — ${JSON.stringify(err?.response?.data || err.message).slice(0, 200)}`);
    }
  }

  // Test 2: Activities with offset
  console.log('\n=== Activities pagination test ===\n');
  await sleep(3000);
  try {
    const resp = await client.get('/v2/ord/btc/activities', {
      params: { collectionSymbol: 'bitmap', limit: 20, offset: 0, kind: 'buying_broadcasted' }
    });
    console.log(`offset=0: ${Array.isArray(resp.data) ? resp.data.length : 'not array'}`);
  } catch (err: any) {
    console.log(`offset=0: ERROR ${err?.response?.status}`);
  }

  await sleep(3000);
  try {
    const resp = await client.get('/v2/ord/btc/activities', {
      params: { collectionSymbol: 'bitmap', limit: 20, offset: 10000 }
    });
    console.log(`offset=10000: ${Array.isArray(resp.data) ? resp.data.length : 'not array'}`);
  } catch (err: any) {
    console.log(`offset=10000: ERROR ${err?.response?.status} — ${JSON.stringify(err?.response?.data || '').slice(0, 200)}`);
  }

  await sleep(3000);
  try {
    const resp = await client.get('/v2/ord/btc/activities', {
      params: { collectionSymbol: 'bitmap', limit: 20, offset: 50000 }
    });
    console.log(`offset=50000: ${Array.isArray(resp.data) ? resp.data.length : 'not array'}`);
  } catch (err: any) {
    console.log(`offset=50000: ERROR ${err?.response?.status} — ${JSON.stringify(err?.response?.data || '').slice(0, 200)}`);
  }

  // Test 3: batch endpoint with different params
  console.log('\n=== Batch endpoint exploration ===\n');
  // Try with tokenIds as query param
  await sleep(3000);
  try {
    const resp = await client.get('/v2/ord/btc/tokens/batch', {
      params: { tokenIds: '7d557d13104deb047bb9a1cf49b4b15ec7dcd69c8e9aabfd9ab6498f3b65e30di0' }
    });
    console.log(`batch tokenIds: ${resp.status} — ${JSON.stringify(resp.data).slice(0, 300)}`);
  } catch (err: any) {
    console.log(`batch tokenIds: ERROR ${err?.response?.status}`);
  }

  // Try with multiple token IDs
  await sleep(3000);
  try {
    const resp = await client.get('/v2/ord/btc/tokens/batch', {
      params: {
        tokenIds: [
          '7d557d13104deb047bb9a1cf49b4b15ec7dcd69c8e9aabfd9ab6498f3b65e30di0',
          '2bd23b7d6e4ffbcfb56099baeb1ca4b48a985e0ede3d72f0ae58ff8b9dd52e90i0'
        ].join(',')
      }
    });
    console.log(`batch 2 tokenIds: ${resp.status} — ${JSON.stringify(resp.data).slice(0, 500)}`);
  } catch (err: any) {
    console.log(`batch 2 tokenIds: ERROR ${err?.response?.status} — ${JSON.stringify(err?.response?.data || '').slice(0, 200)}`);
  }

  console.log('\n=== Done ===');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
