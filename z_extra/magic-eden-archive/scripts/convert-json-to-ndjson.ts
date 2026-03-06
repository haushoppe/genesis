import * as path from 'path';
import * as fs from 'fs';

const TOKENS_DIR = path.resolve(__dirname, '..', 'data', 'tokens');

function main() {
  const files = fs.readdirSync(TOKENS_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('No .json token files found. Nothing to convert.');
    return;
  }

  console.log(`Found ${files.length} .json files to convert.\n`);

  let converted = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const jsonPath = path.join(TOKENS_DIR, file);
    const ndjsonPath = path.join(TOKENS_DIR, file.replace(/\.json$/, '.ndjson'));

    // Skip if .ndjson already exists
    if (fs.existsSync(ndjsonPath)) {
      console.log(`  SKIP ${file} — .ndjson already exists`);
      skipped++;
      continue;
    }

    try {
      const content = fs.readFileSync(jsonPath, 'utf-8');
      const arr = JSON.parse(content);

      if (!Array.isArray(arr)) {
        console.log(`  SKIP ${file} — not a JSON array`);
        skipped++;
        continue;
      }

      const ndjson = arr.map((t: any) => JSON.stringify(t)).join('\n') + '\n';
      fs.writeFileSync(ndjsonPath, ndjson);

      // Verify line count matches
      const lineCount = ndjson.trim().split('\n').length;
      if (lineCount !== arr.length) {
        console.log(`  ERROR ${file} — line count mismatch: ${lineCount} vs ${arr.length}`);
        fs.unlinkSync(ndjsonPath);
        errors++;
        continue;
      }

      // Remove original .json
      fs.unlinkSync(jsonPath);
      console.log(`  OK ${file} — ${arr.length} tokens`);
      converted++;
    } catch (e: any) {
      console.log(`  ERROR ${file} — ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${converted} converted, ${skipped} skipped, ${errors} errors`);
}

main();
