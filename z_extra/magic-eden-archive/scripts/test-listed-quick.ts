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
  timeout: 60_000,
});

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Just check first page of listed items for each collection
  const collections = ['bitmap', 'btc-name', 'domain_dot_sats', 'rare-sats', 'runestone', 'unity', 'kards', 'the-prophecy'];

  for (const symbol of collections) {
    await sleep(2500);
    try {
      // Listed only
      const resp = await client.get('/v2/ord/btc/tokens', {
        params: { collectionSymbol: symbol, limit: 100, offset: 0, sortBy: 'priceAsc', showAll: 'false' }
      });
      const count = resp.data?.tokens?.length || 0;
      console.log(`${symbol.padEnd(20)} listed first page: ${count}`);
    } catch (err: any) {
      console.log(`${symbol.padEnd(20)} ERROR: ${err?.response?.status || err.message}`);
    }
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
