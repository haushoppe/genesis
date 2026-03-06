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

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function tryEndpoint(label: string, url: string, params?: Record<string, any>, headers?: Record<string, string>) {
  await sleep(2500);
  try {
    const resp = await axios.get(url, {
      params,
      headers: { accept: 'application/json', ...headers },
      timeout: 15_000,
    });
    const data = resp.data;
    // Show structure
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      const tokenCount = data.tokens?.length || data.items?.length || data.results?.length || '?';
      const continuation = data.continuation || data.cursor || data.nextCursor || data.next || data.nextPage || 'none';
      console.log(`${label}: OK (keys: ${keys.join(', ')}) tokens/items: ${tokenCount}, continuation: ${continuation}`);
      // Show a sample
      if (data.tokens?.[0]) {
        const t = data.tokens[0];
        console.log(`  sample: id=${t.id?.slice(0,20)}... #${t.inscriptionNumber}`);
      }
    } else {
      console.log(`${label}: OK (type: ${typeof data}, length: ${JSON.stringify(data).length})`);
    }
  } catch (err: any) {
    const status = err?.response?.status;
    const dataSnippet = JSON.stringify(err?.response?.data || '').slice(0, 150);
    console.log(`${label}: ERROR ${status || err.code} — ${dataSnippet || err.message}`);
  }
}

async function main() {
  const symbol = 'bitmap';

  // Test 1: Try v3 API endpoint (like EVM uses)
  console.log('=== Probing for alternative ME API endpoints ===\n');

  // The EVM API uses /v3/rtp/{chain}/tokens — maybe ordinals has similar?
  await tryEndpoint('v3/rtp/bitcoin/tokens', `https://api-mainnet.magiceden.dev/v3/rtp/bitcoin/tokens`, {
    collection: symbol, limit: 20, sortBy: 'inscriptionNumberAsc'
  });

  await tryEndpoint('v3/rtp/btc/tokens', `https://api-mainnet.magiceden.dev/v3/rtp/btc/tokens`, {
    collection: symbol, limit: 20
  });

  // Try the /v4 endpoint (newer EVM API pattern)
  await tryEndpoint('v4/btc/tokens', `https://api-mainnet.magiceden.dev/v4/btc/tokens`, {
    collection: symbol, limit: 20
  });

  // Try without /ord/ prefix
  await tryEndpoint('v2/btc/tokens', `https://api-mainnet.magiceden.dev/v2/btc/tokens`, {
    collectionSymbol: symbol, limit: 20
  });

  // Try the magiceden.io domain instead of api-mainnet
  await tryEndpoint('magiceden.io/api/ord/tokens', `https://magiceden.io/api/ord/btc/tokens`, {
    collectionSymbol: symbol, limit: 20
  });

  // Try api.magiceden.io (older domain)
  await tryEndpoint('api.magiceden.io/v2/ord/btc/tokens', `https://api.magiceden.io/v2/ord/btc/tokens`, {
    collectionSymbol: symbol, limit: 20, showAll: 'true', sortBy: 'inscriptionNumberAsc'
  });

  // Try graphql endpoint
  await tryEndpoint('graphql', `https://api-mainnet.magiceden.dev/graphql`, {}, {});

  // Test 2: Try the official v2 API with "continuation" param  
  console.log('\n=== Testing continuation/cursor params on v2 API ===\n');

  await tryEndpoint('v2 with cursor param', `https://api-mainnet.magiceden.dev/v2/ord/btc/tokens`, {
    collectionSymbol: symbol, limit: 40, sortBy: 'inscriptionNumberAsc', showAll: 'true',
    cursor: '',
  }, { Authorization: `Bearer ${apiKey}` });

  await tryEndpoint('v2 with continuation param', `https://api-mainnet.magiceden.dev/v2/ord/btc/tokens`, {
    collectionSymbol: symbol, limit: 40, sortBy: 'inscriptionNumberAsc', showAll: 'true',
    continuation: '',
  }, { Authorization: `Bearer ${apiKey}` });

  // Test 3: See if the response CONTAINS a cursor/continuation we missed
  console.log('\n=== Inspecting full response structure ===\n');
  await sleep(2500);
  const resp = await axios.get('https://api-mainnet.magiceden.dev/v2/ord/btc/tokens', {
    params: { collectionSymbol: symbol, limit: 20, offset: 0, sortBy: 'inscriptionNumberAsc', showAll: 'true' },
    headers: { accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    timeout: 15_000,
  });
  console.log('Full response keys:', Object.keys(resp.data));
  console.log('Full response (without tokens):', JSON.stringify({ ...resp.data, tokens: `[${resp.data.tokens?.length} items]` }));

  // Test 4: Try the magiceden.us domain (US site)
  console.log('\n=== Testing magiceden.us API ===\n');
  await tryEndpoint('magiceden.us ordinals', `https://magiceden.us/api/v2/ord/btc/tokens`, {
    collectionSymbol: symbol, limit: 20, showAll: 'true'
  });

  // Test 5: Check if there's a search/tokens endpoint  
  console.log('\n=== Testing search endpoints ===\n');
  await tryEndpoint('v2/ord/btc/search/tokens', `https://api-mainnet.magiceden.dev/v2/ord/btc/search/tokens`, {
    collectionSymbol: symbol, limit: 20
  });

  await tryEndpoint('v2/ord/btc/collection/tokens', `https://api-mainnet.magiceden.dev/v2/ord/btc/collection/${symbol}/tokens`, {
    limit: 20
  });

  console.log('\n=== Tests complete ===');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
