import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const COLLECTIONS_DIR = path.join(DATA_DIR, 'collections');
const LOG_FILE = path.join(DATA_DIR, 'download-collection-images.log');

const DELAY_MS = 200;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 15_000;

// Alternative IPFS gateways to try when the original fails (tested 2026-03-19)
const IPFS_GATEWAYS = [
  'https://{cid}.ipfs.w3s.link/',       // Web3.Storage — 307
  'https://4everland.io/ipfs/{cid}',     // 4everland — 301
  'https://dweb.link/ipfs/{cid}',        // dweb.link — 301
];

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let shuttingDown = false;
process.on('SIGINT', () => {
  log('\n*** SIGINT received. Exiting...');
  shuttingDown = true;
});
process.on('SIGTERM', () => {
  log('\n*** SIGTERM received. Exiting...');
  shuttingDown = true;
});

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'];

function getExtensionFromUrl(url: string): string | null {
  const pathname = url.split('?')[0];
  const lastSegment = pathname.split('/').pop() || '';
  if (lastSegment.includes('.')) {
    const ext = lastSegment.split('.').pop()!.toLowerCase();
    if (IMAGE_EXTENSIONS.includes(ext)) {
      return ext;
    }
  }
  return null; // no recognizable extension in URL
}

function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
  };
  const ct = contentType.split(';')[0].trim().toLowerCase();
  return map[ct] || 'png';
}

function extractIpfsCid(url: string): string | null {
  // Match {cid}.ipfs.{gateway}/ pattern
  const subdomainMatch = url.match(/https?:\/\/([a-z0-9]+)\.ipfs\./i);
  if (subdomainMatch) return subdomainMatch[1];
  // Match /ipfs/{cid} pattern
  const pathMatch = url.match(/\/ipfs\/([a-z0-9]+)/i);
  if (pathMatch) return pathMatch[1];
  return null;
}

function getAlternativeUrls(url: string): string[] {
  const cid = extractIpfsCid(url);
  if (!cid) return [];
  return IPFS_GATEWAYS.map(tpl => tpl.replace('{cid}', cid));
}

function downloadFile(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout: TIMEOUT_MS }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destPath).then(resolve);
        return;
      }

      if (res.statusCode !== 200) {
        log(`  HTTP ${res.statusCode} for ${url}`);
        res.resume();
        resolve(false);
        return;
      }

      // Determine extension: prefer URL extension, fallback to content-type
      const contentType = res.headers['content-type'] || '';
      const urlExt = getExtensionFromUrl(url);
      const finalExt = urlExt || getExtensionFromContentType(contentType);

      // Update dest path with correct extension
      const finalPath = destPath.replace(/\.[^.]+$/, `.${finalExt}`);

      const file = fs.createWriteStream(finalPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
      file.on('error', (err) => {
        fs.unlinkSync(finalPath);
        log(`  Write error: ${err.message}`);
        resolve(false);
      });
    });

    req.on('error', (err) => {
      log(`  Request error: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      log(`  Timeout for ${url}`);
      resolve(false);
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const jsonFiles = fs.readdirSync(COLLECTIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  // Check which ones already have an image downloaded
  const existingFiles = new Set(fs.readdirSync(COLLECTIONS_DIR));

  const todo: { symbol: string; imageURI: string }[] = [];

  for (const jsonFile of jsonFiles) {
    const symbol = jsonFile.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(COLLECTIONS_DIR, jsonFile), 'utf-8'));
    const imageURI = data.imageURI;

    if (!imageURI) continue;
    let url = imageURI;
    if (url.startsWith('hhttps://')) url = url.slice(1); // fix ME typo
    if (!url.startsWith('http')) continue;

    // Check if any image file already exists for this symbol
    const hasImage = Array.from(existingFiles).some(f => {
      if (f === jsonFile || f.endsWith('.json')) return false;
      if (!f.startsWith(symbol + '.')) return false;
      const ext = f.slice(symbol.length + 1);
      return IMAGE_EXTENSIONS.includes(ext);
    });

    if (!hasImage) {
      todo.push({ symbol, imageURI: url });
    }
  }

  log('='.repeat(70));
  log('Collection Image Downloader');
  log(`Total JSON files: ${jsonFiles.length} | Already downloaded: ${jsonFiles.length - todo.length} | TODO: ${todo.length}`);
  log(`Delay: ${DELAY_MS}ms | Dry run: ${DRY_RUN}`);
  log('='.repeat(70));

  if (todo.length === 0) {
    log('Nothing to do!');
    return;
  }

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < todo.length; i++) {
    if (shuttingDown) break;

    const { symbol, imageURI } = todo[i];
    const ext = getExtensionFromUrl(imageURI) || 'png';
    const destPath = path.join(COLLECTIONS_DIR, `${symbol}.${ext}`);

    if (DRY_RUN) {
      log(`  [${i + 1}/${todo.length}] DRY: ${symbol} <- ${imageURI.slice(0, 80)}`);
      if (i >= 5) break;
      continue;
    }

    let success = false;
    // Try original URL first
    await sleep(DELAY_MS);
    success = await downloadFile(imageURI, destPath);

    // If failed and it's an IPFS URL, try alternative gateways
    if (!success && !shuttingDown) {
      const altUrls = getAlternativeUrls(imageURI);
      for (const altUrl of altUrls) {
        if (shuttingDown || success) break;
        await sleep(DELAY_MS);
        success = await downloadFile(altUrl, destPath);
      }
    }

    if (success) {
      downloaded++;
    } else {
      failed++;
      log(`  [${i + 1}/${todo.length}] FAILED: ${symbol}`);
    }

    if ((i + 1) % 100 === 0) {
      log(`  [${i + 1}/${todo.length}] downloaded: ${downloaded}, failed: ${failed}`);
    }
  }

  log('='.repeat(70));
  log(`DONE — downloaded: ${downloaded}, failed: ${failed}`);
  log('='.repeat(70));
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
