import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

const DATA_DIR = path.resolve(__dirname, '..', 'data');

interface CollectionStats {
  collectionSymbol: string;
  totalSupply: number;
  name: string;
}

interface ValidationResult {
  symbol: string;
  name: string;
  expectedSupply: number;
  actualTokens: number;
  format: 'ndjson' | 'missing';
  status: 'ok' | 'incomplete' | 'over' | 'missing' | 'error';
  detail?: string;
}

/**
 * Count tokens in an NDJSON file (one JSON object per line) using streaming.
 */
async function countNdjsonTokens(filePath: string): Promise<number> {
  let count = 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) count++;
  }
  return count;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

async function main() {
  // Load phase1 stats for expected supply
  const phase1File = path.join(DATA_DIR, 'phase1-collections.json');
  if (!fs.existsSync(phase1File)) {
    console.error('ERROR: phase1-collections.json not found');
    process.exit(1);
  }

  const stats: CollectionStats[] = JSON.parse(fs.readFileSync(phase1File, 'utf-8'));
  const tokensDir = path.join(DATA_DIR, 'tokens');

  console.log(`Validating ${stats.length} collections...\n`);

  const results: ValidationResult[] = [];
  let processedCount = 0;

  for (const col of stats) {
    processedCount++;
    const sanitized = sanitizeFilename(col.collectionSymbol);
    const filePath = path.join(tokensDir, `${sanitized}.ndjson`);

    const result: ValidationResult = {
      symbol: col.collectionSymbol,
      name: col.name || col.collectionSymbol,
      expectedSupply: col.totalSupply,
      actualTokens: 0,
      format: 'missing',
      status: 'missing',
    };

    try {
      if (fs.existsSync(filePath)) {
        result.format = 'ndjson';
        result.actualTokens = await countNdjsonTokens(filePath);
      } else {
        result.status = 'missing';
        result.detail = 'No .ndjson file found';
        results.push(result);
        continue;
      }

      const pct = col.totalSupply > 0 ? (result.actualTokens / col.totalSupply * 100) : 0;

      if (result.actualTokens === col.totalSupply) {
        result.status = 'ok';
      } else if (result.actualTokens > col.totalSupply) {
        result.status = 'over';
        result.detail = `+${result.actualTokens - col.totalSupply} extra (${pct.toFixed(1)}%)`;
      } else {
        result.status = 'incomplete';
        result.detail = `missing ${col.totalSupply - result.actualTokens} (${pct.toFixed(1)}%)`;
      }
    } catch (e: any) {
      result.status = 'error';
      result.detail = e.message;
    }

    results.push(result);

    if (processedCount % 100 === 0) {
      process.stdout.write(`  ...${processedCount}/${stats.length}\r`);
    }
  }

  // Sort: problems first, then by symbol
  const statusOrder: Record<string, number> = { missing: 0, error: 1, incomplete: 2, over: 3, ok: 4 };
  results.sort((a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5) || a.symbol.localeCompare(b.symbol));

  // Summary counts
  const ok = results.filter(r => r.status === 'ok');
  const incomplete = results.filter(r => r.status === 'incomplete');
  const over = results.filter(r => r.status === 'over');
  const missing = results.filter(r => r.status === 'missing');
  const errors = results.filter(r => r.status === 'error');

  const totalExpected = results.reduce((s, r) => s + r.expectedSupply, 0);
  const totalActual = results.reduce((s, r) => s + r.actualTokens, 0);

  // Print problems
  if (missing.length > 0) {
    console.log(`\n--- MISSING (${missing.length}) ---`);
    for (const r of missing) {
      console.log(`  ${r.symbol}`);
    }
  }

  if (errors.length > 0) {
    console.log(`\n--- ERRORS (${errors.length}) ---`);
    for (const r of errors) {
      console.log(`  ${r.symbol}: ${r.detail}`);
    }
  }

  if (incomplete.length > 0) {
    console.log(`\n--- INCOMPLETE (${incomplete.length}) ---`);
    // Sort by percentage ascending (worst first)
    incomplete.sort((a, b) => (a.actualTokens / (a.expectedSupply || 1)) - (b.actualTokens / (b.expectedSupply || 1)));
    for (const r of incomplete) {
      const pct = r.expectedSupply > 0 ? (r.actualTokens / r.expectedSupply * 100).toFixed(1) : '?';
      console.log(`  ${r.symbol.padEnd(40)} ${String(r.actualTokens).padStart(8)} / ${String(r.expectedSupply).padStart(8)}  (${pct}%)`);
    }
  }

  if (over.length > 0) {
    console.log(`\n--- OVER-FETCHED (${over.length}) ---`);
    for (const r of over) {
      console.log(`  ${r.symbol.padEnd(40)} ${String(r.actualTokens).padStart(8)} / ${String(r.expectedSupply).padStart(8)}  ${r.detail}`);
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log(`Total collections:  ${results.length}`);
  console.log(`  OK:               ${ok.length}`);
  console.log(`  Incomplete:       ${incomplete.length}`);
  console.log(`  Over-fetched:     ${over.length}`);
  console.log(`  Missing:          ${missing.length}`);
  console.log(`  Errors:           ${errors.length}`);
  console.log(`----------------------------------------`);
  console.log(`Total tokens expected: ${totalExpected.toLocaleString()}`);
  console.log(`Total tokens fetched:  ${totalActual.toLocaleString()}`);
  console.log(`Coverage:              ${(totalActual / totalExpected * 100).toFixed(2)}%`);
  console.log('========================================');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
