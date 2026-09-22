import { defineConfig } from '@playwright/test';
import * as path from 'node:path';

// The SDK's regtest helpers (seedDirtyCoin and friends) shell into docker by
// container name, defaulting to the SDK's own stack (`ordpool-e2e-*`). Cubes
// runs the same compose file under its own project prefix so the two stacks can
// coexist on one machine, so the names have to be handed over explicitly.
// Without this a helper reports "No such container", which reads like a stack
// that is down rather than a naming mismatch.
process.env.REGTEST_BITCOIND_CONTAINER ??= 'cubes-e2e-bitcoind';
process.env.REGTEST_ORD_CONTAINER ??= 'cubes-e2e-cat21-ord';
process.env.REGTEST_ORD_STOCK_CONTAINER ??= 'cubes-e2e-ord-stock';
// Same reason for the bitcoind wallet: the compose file creates it named after
// the project prefix, so the helpers have to be told which one to spend from.
process.env.REGTEST_WALLET ??= 'cubes-e2e';

/**
 * Regtest e2e suite for cubes-frontend.
 *
 * These specs drive the REAL cubes-frontend UI in headed Chromium
 * against a REAL regtest stack (bitcoind + electrs + ord) and a
 * REAL wallet extension (.crx unpacked into e2e/extensions/).
 *
 * They exist to prove — for every wallet in the picker — that a
 * user clicking through the form to a broadcast produces an
 * inscription that ord actually indexes. Not "the harness works",
 * "the button click works".
 *
 * Structural mirror of ordpool-sdk/e2e/playwright/playwright.config.ts.
 * Kept separate from the existing shell smoke suite (../smoke.spec.ts)
 * so unit-CI stays fast and regtest CI stays comprehensive.
 */
export default defineConfig({
  testDir: path.resolve(__dirname, 'specs'),
  globalSetup: path.resolve(__dirname, 'global-setup.ts'),

  // Extension state must not race — one worker, serial execution.
  fullyParallel: false,
  workers: 1,

  retries: 0,                // deliberate: a retry hides a real defect
  timeout: 360_000,          // 6 min per test; commit+reveal round-trip is slow
  expect: { timeout: 20_000 },

  use: {
    headless: false,         // extension injection requires headed
    screenshot: 'on',        // every step, every test — CI artifact trail
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },

  outputDir: path.resolve(__dirname, '../../test-results-regtest'),
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.resolve(__dirname, '../../playwright-report-regtest') }],
  ],

  // The specs drive the cubes-frontend UI, so we need it up. Playwright spawns
  // `npm start` (Angular dev server on :4203, regtest env). The funding-safety
  // content scan hits the REAL ord instances the docker stack brings up
  // (:8081 stock ord, :8080 cat21-ord), not a stub. CI reuses a server if it's
  // already running.
  webServer: [
    {
      // Regtest-configured dev server. Swaps environment.ts →
      // environment.regtest.ts so mempoolApiUrl hits localhost:3010 +
      // the tip address is a regtest bcrt1p…
      command: 'npm run start:regtest',
      cwd: path.resolve(__dirname, '../..'),
      port: 4203,
      reuseExistingServer: !process.env.CI,
      // A cold Angular build with no `.angular/cache` measured past three
      // minutes here, and clearing that cache is the documented fix for a
      // stale SDK prebundle, so the slow case is a normal one.
      timeout: 420_000,
    },
  ],
});
