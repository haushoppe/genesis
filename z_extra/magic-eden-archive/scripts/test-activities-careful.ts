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
  timeout: 60_000,
});

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Test activities with proper spacing
  console.log('=== Activities endpoint (careful rate limiting) ===\n');

  // Test 1: Basic activities call
  await sleep(5000);
  try {
    const resp = await client.get('/v2/ord/btc/activities', {
      params: { collectionSymbol: 'bitmap', limit: 100 }
    });
    const data = resp.data;
    if (Array.isArray(data)) {
      console.log(`Activities (no kind): ${data.length} results`);
      if (data.length > 0) {
        console.log(`Keys: ${Object.keys(data[0]).join(', ')}`);
        console.log(`Sample: ${JSON.stringify(data[0]).slice(0, 400)}`);
      }
    } else {
      console.log(`Activities response type: ${typeof data}, keys: ${Object.keys(data || {}).join(', ')}`);
      console.log(`Full: ${JSON.stringify(data).slice(0, 500)}`);
    }
  } catch (err: any) {
    console.log(`ERROR: ${err?.response?.status} — ${JSON.stringify(err?.response?.data || err.message).slice(0, 200)}`);
  }

  // Test 2: Can we paginate activities beyond 10K?
  console.log('\n=== Activities offset test ===');
  for (const offset of [0, 100, 1000, 5000, 10000, 10040, 20000, 50000]) {
    await sleep(5000);
    try {
      const resp = await client.get('/v2/ord/btc/activities', {
        params: { collectionSymbol: 'bitmap', limit: 100, offset }
      });
      const data = resp.data;
      const len = Array.isArray(data) ? data.length : (data?.activities?.length || '?');
      console.log(`offset=${String(offset).padStart(6)}: ${len} results`);
    } catch (err: any) {
      console.log(`offset=${String(offset).padStart(6)}: ERROR ${err?.response?.status} — ${JSON.stringify(err?.response?.data || '').slice(0, 150)}`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
