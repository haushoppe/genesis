import * as fs from 'fs';
import * as path from 'path';

const STATS_DIR = path.resolve(__dirname, '..', 'data', 'collection-stats');
const COLLECTIONS_DIR = path.resolve(__dirname, '..', 'data', 'collections');

function main() {
  const files = fs.readdirSync(STATS_DIR).filter(f => f.endsWith('.json'));
  console.log(`Checking ${files.length} stats files...\n`);

  let valid = 0;
  let invalid = 0;
  let empty = 0;
  const allKeys = new Map<string, number>();
  const keyTypes = new Map<string, Set<string>>();
  const errors: string[] = [];
  const sampleValues: Record<string, any[]> = {};

  for (const file of files) {
    const fpath = path.join(STATS_DIR, file);
    const raw = fs.readFileSync(fpath, 'utf-8').trim();

    if (!raw) {
      empty++;
      errors.push(`EMPTY: ${file}`);
      continue;
    }

    try {
      const data = JSON.parse(raw);

      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        invalid++;
        errors.push(`NOT_OBJECT: ${file} — type: ${typeof data}`);
        continue;
      }

      valid++;

      for (const [key, val] of Object.entries(data)) {
        allKeys.set(key, (allKeys.get(key) || 0) + 1);

        if (!keyTypes.has(key)) keyTypes.set(key, new Set());
        keyTypes.get(key)!.add(typeof val);

        // Collect first 3 non-null sample values per key
        if (!sampleValues[key]) sampleValues[key] = [];
        if (sampleValues[key].length < 3 && val !== null && val !== undefined && val !== '') {
          sampleValues[key].push(val);
        }
      }
    } catch (err: any) {
      invalid++;
      errors.push(`PARSE_ERROR: ${file} — ${err.message}`);
    }
  }

  // Report
  console.log('=== SUMMARY ===');
  console.log(`Valid JSON objects: ${valid}`);
  console.log(`Invalid/parse errors: ${invalid}`);
  console.log(`Empty files: ${empty}`);
  console.log(`Total: ${files.length}`);

  console.log('\n=== SCHEMA (all keys across all files) ===');
  const sortedKeys = Array.from(allKeys.entries()).sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sortedKeys) {
    const types = Array.from(keyTypes.get(key)!).join('|');
    const pct = ((count / valid) * 100).toFixed(1);
    const samples = (sampleValues[key] || []).map(v =>
      typeof v === 'string' && v.length > 40 ? v.slice(0, 40) + '...' : v
    );
    console.log(`  ${key}: ${count}/${valid} (${pct}%) — type: ${types} — samples: ${JSON.stringify(samples)}`);
  }

  // Check for window-related fields
  const windowRelated = sortedKeys.filter(([k]) =>
    /window|period|time|interval|30d|7d|1d/i.test(k)
  );
  if (windowRelated.length > 0) {
    console.log('\n=== WINDOW-RELATED KEYS ===');
    for (const [key, count] of windowRelated) {
      console.log(`  ${key}: ${count} files`);
    }
  } else {
    console.log('\n=== NO WINDOW-RELATED KEYS FOUND ===');
    console.log('  The window=30d parameter was likely ignored — data appears to be all-time stats.');
  }

  // Cross-check with collections dir
  const collectionFiles = new Set(fs.readdirSync(COLLECTIONS_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')));
  const statsFiles = new Set(files.map(f => f.replace('.json', '')));
  const missingStats = Array.from(collectionFiles).filter(s => !statsFiles.has(s));
  const missingCollections = Array.from(statsFiles).filter(s => !collectionFiles.has(s));

  console.log(`\n=== CROSS-CHECK WITH COLLECTIONS ===`);
  console.log(`Collections with stats: ${[...collectionFiles].filter(s => statsFiles.has(s)).length}`);
  console.log(`Collections missing stats: ${missingStats.length}`);
  console.log(`Stats missing collection: ${missingCollections.length}`);
  if (missingStats.length > 0 && missingStats.length <= 20) {
    console.log(`  Missing stats: ${missingStats.join(', ')}`);
  }
  if (missingCollections.length > 0 && missingCollections.length <= 20) {
    console.log(`  Missing collection: ${missingCollections.join(', ')}`);
  }

  // Value distribution for key numeric fields
  console.log('\n=== VALUE DISTRIBUTIONS ===');
  const numericKeys = ['totalVolume', 'owners', 'supply', 'floorPrice', 'totalListed'];
  for (const key of numericKeys) {
    const values: number[] = [];
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(STATS_DIR, file), 'utf-8'));
        const v = Number(data[key]);
        if (!isNaN(v)) values.push(v);
      } catch { /* skip */ }
    }
    if (values.length === 0) continue;
    values.sort((a, b) => a - b);
    const zeros = values.filter(v => v === 0).length;
    const nonZero = values.filter(v => v > 0);
    console.log(`  ${key}: ${values.length} values, ${zeros} zeros (${((zeros / values.length) * 100).toFixed(1)}%)`);
    if (nonZero.length > 0) {
      console.log(`    min: ${nonZero[0]}, median: ${nonZero[Math.floor(nonZero.length / 2)]}, max: ${nonZero[nonZero.length - 1]}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n=== ERRORS ===');
    for (const e of errors) console.log(`  ${e}`);
  }
}

main();
