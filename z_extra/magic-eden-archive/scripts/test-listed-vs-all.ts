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

async function countPaginated(symbol: string, showAll: string, sortBy: string): Promise<number> {
  let offset = 0;
  let total = 0;
  while (true) {
    await sleep(2500);
    try {
      const resp = await client.get('/v2/ord/btc/tokens', {
        params: { collectionSymbol: symbol, limit: 100, offset, sortBy, showAll }
      });
      const tokens = resp.data?.tokens || [];
      total += tokens.length;
      if (tokens.length < 100) break;
      offset += 100;
      if (offset >= 10100) {
        console.log(`  ... hit offset limit at ${offset}, have ${total} so far`);
        break;
      }
      if (offset % 1000 === 0) console.log(`  ... offset ${offset}, count ${total}`);
    } catch (err: any) {
      if (err?.response?.status === 400) {
        console.log(`  ... 400 at offset ${offset}, have ${total}`);
        break;
      }
      throw err;
    }
  }
  return total;
}

async function main() {
  // Check how many tokens are LISTED vs ALL for our gap collections
  const collections = ['bitmap', 'btc-name', 'domain_dot_sats', 'rare-sats', 'runestone', 'unity'];

  for (const symbol of collections) {
    console.log(`\n=== ${symbol} ===`);

    // Listed only (showAll=false)
    await sleep(2500);
    const listedResp = await client.get('/v2/ord/btc/tokens', {
      params: { collectionSymbol: symbol, limit: 100, offset: 0, sortBy: 'priceAsc', showAll: 'false' }
    });
    const listedFirst = listedResp.data?.tokens?.length || 0;
    console.log(`  Listed first page: ${listedFirst} tokens`);

    if (listedFirst > 0) {
      // Check if listed count is small enough to fully paginate
      console.log(`  Counting all listed...`);
      const listedTotal = await countPaginated(symbol, 'false', 'priceAsc');
      console.log(`  LISTED total: ${listedTotal}`);
    } else {
      console.log(`  LISTED total: 0`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
