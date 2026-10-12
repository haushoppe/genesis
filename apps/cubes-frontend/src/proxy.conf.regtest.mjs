// Dev-server proxy of the regtest build. The targets are the host ports of the
// regtest stack this build was generated for, read from
// `src/environments/regtest-stack.generated.ts` (scripts/write-regtest-stack.mjs,
// from the slot environment), the same file `environment.regtest.ts` builds
// its URLs from, so the app and its proxy never address two stacks.
//
// - `/content` -> stock ord: the cube renderer and every side the minted body
//   loads through `<script src=/content/...>`.
// - `/api/v1` -> the ordpool backend (fee estimates and the mempool-witness
//   preview).
// - `/api` -> electrs, `/api` stripped, since electrs serves its Esplora
//   endpoints at the root (/address/{}/utxo, /tx, /tx/{}/hex, ...).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const generated = resolve(dirname(fileURLToPath(import.meta.url)), 'environments/regtest-stack.generated.ts');
const literal = readFileSync(generated, 'utf8').match(/^export const regtestStack = (\{.*\});$/m);
if (!literal) {
  throw new Error(`${generated} carries no regtestStack literal; run node scripts/write-regtest-stack.mjs`);
}
const stack = JSON.parse(literal[1]);
const target = (port) => `http://127.0.0.1:${port}`;

export default {
  '/content': {
    target: target(stack.ordStock),
    secure: false,
    changeOrigin: true,
  },
  '/api/v1': {
    target: target(stack.ordpoolBackend),
    secure: false,
    changeOrigin: true,
  },
  '/api': {
    target: target(stack.electrs),
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    logLevel: 'debug',
  },
};
