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

async function tryRequest(label: string, method: string, url: string, params?: any, data?: any) {
  await sleep(3000);
  try {
    const config: any = { headers: { accept: 'application/json', Authorization: `Bearer ${apiKey}` }, timeout: 30_000 };
    let resp;
    if (method === 'GET') {
      resp = await axios.get(url, { ...config, params });
    } else {
      resp = await axios.post(url, data, { ...config, params });
    }
    const rdata = resp.data;
    if (typeof rdata === 'object' && rdata !== null) {
      console.log(`${label}: ${resp.status} — keys: ${Object.keys(rdata).join(', ')}`);
      const tokLen = rdata.tokens?.length || rdata.items?.length || rdata.results?.length;
      if (tokLen) console.log(`  count: ${tokLen}`);
      // Show sample
      console.log(`  sample: ${JSON.stringify(rdata).slice(0, 300)}`);
    } else {
      console.log(`${label}: ${resp.status} — ${String(rdata).slice(0, 200)}`);
    }
  } catch (err: any) {
    const status = err?.response?.status;
    const errData = JSON.stringify(err?.response?.data || err.message).slice(0, 300);
    console.log(`${label}: ERROR ${status} — ${errData}`);
  }
}

async function main() {
  const base = 'https://api-mainnet.magiceden.dev';

  // Test batch endpoint (GET and POST)
  console.log('=== Testing batch endpoint ===\n');
  await tryRequest('GET batch', 'GET', `${base}/v2/ord/btc/tokens/batch`, {
    collectionSymbol: 'bitmap', limit: 20
  });
  await tryRequest('POST batch (collectionSymbol)', 'POST', `${base}/v2/ord/btc/tokens/batch`, {}, {
    collectionSymbol: 'bitmap', limit: 20
  });
  await tryRequest('POST batch (tokenIds)', 'POST', `${base}/v2/ord/btc/tokens/batch`, {}, {
    tokenIds: ['7d557d13104deb047bb9a1cf49b4b15ec7dcd69c8e9aabfd9ab6498f3b65e30di0']
  });

  // Try undiscovered endpoints
  console.log('\n=== Testing other potential endpoints ===\n');
  await tryRequest('v2/ord/btc/collection/bitmap', 'GET', `${base}/v2/ord/btc/collection/bitmap`, {});
  await tryRequest('v2/ord/btc/collections/bitmap/tokens', 'GET', `${base}/v2/ord/btc/collections/bitmap/tokens`, { limit: 20 });
  await tryRequest('v2/ord/btc/inscriptions', 'GET', `${base}/v2/ord/btc/inscriptions`, { collectionSymbol: 'bitmap', limit: 20 });

  // Try the /activities endpoint - it might give us inscription IDs in a different way
  console.log('\n=== Testing activities endpoint (might have different pagination) ===\n');
  await tryRequest('v2/ord/btc/activities', 'GET', `${base}/v2/ord/btc/activities`, {
    collectionSymbol: 'bitmap', limit: 20, kind: 'buying_broadcasted'
  });

  // Try stat endpoint to see all fields
  console.log('\n=== Collection stat endpoint ===\n');
  await tryRequest('v2/ord/btc/stat', 'GET', `${base}/v2/ord/btc/stat`, { collectionSymbol: 'bitmap' });

  // Maybe there's a "holders" or "owners" endpoint
  console.log('\n=== Testing holders/owners endpoints ===\n');
  await tryRequest('v2/ord/btc/holders', 'GET', `${base}/v2/ord/btc/holders`, { collectionSymbol: 'bitmap' });
  await tryRequest('v2/ord/btc/owners', 'GET', `${base}/v2/ord/btc/owners`, { collectionSymbol: 'bitmap' });
  await tryRequest('v2/ord/btc/collections/bitmap/holders', 'GET', `${base}/v2/ord/btc/collections/bitmap/holders`, {});

  console.log('\n=== Done ===');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
