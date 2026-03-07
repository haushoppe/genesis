import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TOKENS_DIR = path.join(DATA_DIR, 'tokens');
const OUTPUT_FILE = path.join(DATA_DIR, 'all-symbols.txt');

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

async function main() {
  // Only scan ME files — BiS files use 'slug' not 'collectionSymbol'
  const files = fs.readdirSync(TOKENS_DIR).filter(f => f.endsWith('.ndjson') && !f.endsWith('.bis.ndjson'));
  console.log(`Scanning ${files.length} ME ndjson files...`);

  const allSymbols = new Set<string>();
  let totalTokens = 0;
  let fileCount = 0;

  for (const file of files) {
    fileCount++;
    const fpath = path.join(TOKENS_DIR, file);
    const stream = fs.createReadStream(fpath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const token = JSON.parse(line);
        totalTokens++;

        // Collect collectionSymbol from the token itself
        const cs = token.collectionSymbol;
        if (cs && typeof cs === 'string' && cs.trim()) {
          allSymbols.add(cs.trim());
        }

        // Also check nested collection.symbol
        const nested = token.collection?.symbol;
        if (nested && typeof nested === 'string' && nested.trim()) {
          allSymbols.add(nested.trim());
        }
      } catch { /* skip bad lines */ }
    }

    if (fileCount % 500 === 0) {
      console.log(`  ${fileCount}/${files.length} files, ${totalTokens.toLocaleString()} tokens, ${allSymbols.size.toLocaleString()} symbols so far`);
    }
  }

  // Collect symbols we already have as files (both raw and sanitized forms)
  const allFiles = fs.readdirSync(TOKENS_DIR).filter(f => f.endsWith('.ndjson'));
  const fileSymbols = new Set<string>();
  for (const f of allFiles) {
    fileSymbols.add(f.replace('.bis.ndjson', '').replace('.ndjson', ''));
  }

  const sorted = Array.from(allSymbols).sort();
  fs.writeFileSync(OUTPUT_FILE, sorted.join('\n') + '\n');

  // Compare: check both raw symbol and sanitized version against file list
  const newSymbols = sorted.filter(s => !fileSymbols.has(s) && !fileSymbols.has(sanitizeFilename(s)));

  console.log(`\nTotal tokens scanned: ${totalTokens.toLocaleString()}`);
  console.log(`Unique symbols found in token data: ${allSymbols.size.toLocaleString()}`);
  console.log(`Symbols we have as files: ${fileSymbols.size.toLocaleString()}`);
  console.log(`NEW symbols (in tokens but no file): ${newSymbols.length}`);
  console.log(`\nSaved all ${sorted.length} symbols to ${OUTPUT_FILE}`);

  if (newSymbols.length > 0) {
    console.log(`\nNew symbols:`);
    for (const s of newSymbols) {
      console.log(`  '${s}',`);
    }
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
