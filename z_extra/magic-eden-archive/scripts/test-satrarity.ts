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

async function test(label: string, params: Record<string, any>) {
  await sleep(2500);
  try {
    const resp = await client.get('/v2/ord/btc/tokens', { params });
    const tokens = resp.data?.tokens || [];
    console.log(`${label}: ${tokens.length} tokens`);
    if (tokens.length > 0) {
      console.log(`  first: #${tokens[0].inscriptionNumber}, last: #${tokens[tokens.length - 1].inscriptionNumber}`);
    }
  } catch (err: any) {
    const status = err?.response?.status;
    console.log(`${label}: ERROR ${status} — ${JSON.stringify(err?.response?.data || err.message).slice(0, 200)}`);
  }
}

async function main() {
  // Test satRarity subsets on bitmap
  console.log('=== satRarity filter on bitmap (938K supply) ===\n');
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  for (const r of rarities) {
    await test(`bitmap satRarity=${r}`, {
      collectionSymbol: 'bitmap', limit: 40, offset: 0,
      sortBy: 'inscriptionNumberAsc', showAll: 'true', satRarity: r
    });
  }

  // Does satRarity reset the offset limit?
  console.log('\n=== satRarity + offset limit test ===\n');
  await test('bitmap common offset=10000', {
    collectionSymbol: 'bitmap', limit: 40, offset: 10000,
    sortBy: 'inscriptionNumberAsc', showAll: 'true', satRarity: 'common'
  });
  await test('bitmap common offset=10040', {
    collectionSymbol: 'bitmap', limit: 40, offset: 10040,
    sortBy: 'inscriptionNumberAsc', showAll: 'true', satRarity: 'common'
  });

  // Test ownerAddress filter — can we paginate per-owner?
  console.log('\n=== ownerAddress filter test ===\n');
  // First get a token from bitmap to find an owner
  await sleep(2500);
  const resp = await client.get('/v2/ord/btc/tokens', {
    params: { collectionSymbol: 'bitmap', limit: 20, offset: 0, sortBy: 'inscriptionNumberAsc', showAll: 'true' }
  });
  const sampleOwner = resp.data?.tokens?.[0]?.owner;
  if (sampleOwner) {
    console.log(`Sample owner: ${sampleOwner}`);
    await test(`bitmap owner=${sampleOwner.slice(0,8)}...`, {
      collectionSymbol: 'bitmap', limit: 40, offset: 0,
      sortBy: 'inscriptionNumberAsc', showAll: 'true', ownerAddress: sampleOwner
    });
  }

  console.log('\n=== Tests complete ===');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
