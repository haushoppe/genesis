// `src/environments/regtest-inscriptions.generated.ts` is written by the
// regtest bootstrap and gitignored, because regtest inscription ids depend on
// the funding txids and change with every fresh chain.
//
// Nothing outside a regtest run uses it, but `environment.regtest.ts` imports
// it statically, so `tsc` and `ng build` need the module to EXIST. Without
// this the production build fails on a missing module plus a cascade of
// implicit-any errors in the e2e helpers, which says nothing about production
// and blocks the deploy.
//
// So write a placeholder when the file is absent. The ids are deliberately not
// valid inscription ids: a regtest run that skipped the bootstrap then fails
// loudly on self-describing 404s rather than quietly reaching for mainnet.
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)),
  '../src/environments/regtest-inscriptions.generated.ts');
if (existsSync(out)) process.exit(0);

const missing = (what) => `MISSING-${what}-run-npm-run-e2e:regtest:up`;
writeFileSync(out, `// PLACEHOLDER written by scripts/ensure-regtest-inscriptions.mjs because the
// regtest bootstrap has not run. Real ids come from
// e2e/regtest/inscribe-fixtures.sh. These are not inscription ids on purpose:
// they 404 and say why.
export const regtestInscriptions = {
  cubeRenderer: '${missing('renderer')}',
  fallbackSides: [
${Array.from({ length: 6 }, (_, i) => `    '${missing(`side-${i + 1}`)}',`).join('\n')}
  ],
  nonImageSide: '${missing('non-image-side')}',
};
`);
console.log('wrote placeholder regtest-inscriptions.generated.ts (bootstrap not run)');
