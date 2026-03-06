import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function tryUrl(label: string, url: string, params?: Record<string, any>) {
  await sleep(2000);
  try {
    const resp = await axios.get(url, {
      params,
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        referer: 'https://magiceden.io/ordinals/marketplace/bitmap',
      },
      timeout: 15_000,
      maxRedirects: 0,
      validateStatus: () => true,
    });
    const data = resp.data;
    const status = resp.status;
    if (status >= 300 && status < 400) {
      console.log(`${label}: ${status} REDIRECT → ${resp.headers.location}`);
      return;
    }
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      const tokenCount = data.tokens?.length || data.items?.length || data.results?.length || data.data?.length || '?';
      console.log(`${label}: ${status} (keys: ${keys.slice(0, 10).join(', ')}) tokens: ${tokenCount}`);
      // Check for any cursor/continuation/pagination fields
      for (const key of ['cursor', 'continuation', 'nextCursor', 'next', 'nextPage', 'pageInfo', 'paging', 'pagination', 'hasMore', 'total']) {
        if (data[key] !== undefined) {
          console.log(`  >>> FOUND pagination field: ${key} = ${JSON.stringify(data[key]).slice(0, 100)}`);
        }
      }
    } else {
      const snippet = String(data).slice(0, 150);
      console.log(`${label}: ${status} (${typeof data}) ${snippet}`);
    }
  } catch (err: any) {
    console.log(`${label}: ERROR ${err.code || err.message}`);
  }
}

async function main() {
  console.log('=== Probing Next.js API routes and internal endpoints ===\n');
  
  // Common Next.js API route patterns
  await tryUrl('magiceden.io/api/tokens', 'https://magiceden.io/api/tokens', { collectionSymbol: 'bitmap', limit: 20 });
  await tryUrl('magiceden.io/api/v2/tokens', 'https://magiceden.io/api/v2/tokens', { collectionSymbol: 'bitmap', limit: 20 });
  await tryUrl('magiceden.io/api/ord/tokens', 'https://magiceden.io/api/ord/tokens', { collectionSymbol: 'bitmap' });
  
  // Try magiceden.us (the new US domain)
  await tryUrl('magiceden.us ordinals', 'https://magiceden.us/ordinals/marketplace/bitmap', {});

  // The nftkitten gist mentions RPC endpoints
  await tryUrl('rpc getListedNftsByCollectionSymbol', 'https://api-mainnet.magiceden.dev/rpc/getListedNftsByCollectionSymbol', {
    collectionSymbol: 'bitmap', limit: 20
  });

  // Try v2 with different headers (like the website would send)
  console.log('\n=== Testing v2 API with website-like headers ===\n');
  await sleep(2000);
  try {
    const resp = await axios.get('https://api-mainnet.magiceden.dev/v2/ord/btc/tokens', {
      params: { collectionSymbol: 'bitmap', limit: 40, offset: 0, sortBy: 'inscriptionNumberAsc', showAll: 'true' },
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        origin: 'https://magiceden.io',
        referer: 'https://magiceden.io/',
      },
      timeout: 30_000,
    });
    console.log('Website-like request: ' + resp.status);
    console.log('Response keys:', Object.keys(resp.data));
    console.log('Response headers with pagination:', 
      Object.entries(resp.headers)
        .filter(([k]) => k.includes('page') || k.includes('cursor') || k.includes('total') || k.includes('next') || k.includes('link'))
        .map(([k, v]) => `${k}: ${v}`)
    );
    console.log('All response headers:', Object.keys(resp.headers).join(', '));
  } catch (err: any) {
    console.log('Website-like request: ERROR', err.message);
  }

  // Try the /idxv2/ path pattern (sometimes used for indexer v2)
  console.log('\n=== Testing indexer endpoints ===\n');
  await tryUrl('idxv2/ord/btc/tokens', 'https://api-mainnet.magiceden.dev/idxv2/ord/btc/tokens', {
    collectionSymbol: 'bitmap', limit: 20
  });
  await tryUrl('idx/ord/btc/tokens', 'https://api-mainnet.magiceden.dev/idx/ord/btc/tokens', {
    collectionSymbol: 'bitmap', limit: 20
  });

  // Try batch/bulk endpoints
  await tryUrl('v2/ord/btc/tokens/batch', 'https://api-mainnet.magiceden.dev/v2/ord/btc/tokens/batch', {
    collectionSymbol: 'bitmap'
  });

  // Try the Reservoir-style API that ME uses for EVM
  // ME acquired Reservoir protocol
  await tryUrl('v3/rtp/ord/tokens', 'https://api-mainnet.magiceden.dev/v3/rtp/ord/tokens', {
    collection: 'bitmap', limit: 20
  });

  console.log('\n=== Done ===');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
