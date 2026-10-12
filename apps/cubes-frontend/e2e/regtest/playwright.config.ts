import { defineConfig } from '@playwright/test';
import * as path from 'node:path';
import { E2E_TIMEOUT_ENV, stackPort } from 'ordpool-sdk/e2e';

// Everything this suite reaches comes from the regtest stack's slot: the SDK's
// helpers read the container names (REGTEST_*_CONTAINER) and host ports
// (E2E_*_HOST_PORT) from the slot environment, and fall back to slot 0's when
// it is unset. Run the suite through the slot CLI (`npm run e2e:regtest:run`),
// which acquires the slot and exports that environment.
//
// The app is served on the slot's app port, so two lanes in two slots never
// share a dev server. `CUBES_URL` in regtest-helpers.ts reads the same port.
const APP_PORT = stackPort('app');

/**
 * The per-wait bound (TESTING.md): every assertion, action, navigation and
 * page event, and, through ORDPOOL_E2E_TIMEOUT_MS, every SDK polling helper
 * (electrs, ord, bitcoind, a wallet's service worker). A state that needs
 * longer to arrive is a defect in the app, the harness or the helper, fixed
 * there, never by raising this bound.
 */
const WAIT_TIMEOUT_MS = 30_000;
process.env[E2E_TIMEOUT_ENV] = String(WAIT_TIMEOUT_MS);

/**
 * The per-test bound. A test is a sequence of waits, not one wait.
 * Twice the longest green test, rounded up to the minute: OKX at 1.7 min
 * (at most 105 s, Playwright rounds to 0.1 min) in genesis run 36241644147;
 * the next longest are OKX 1.6 min (run 37228963450) and 1.5 min (run
 * 38056243263).
 */
const TEST_TIMEOUT_MS = 240_000;

/**
 * Regtest e2e suite for cubes-frontend.
 *
 * These specs drive the REAL cubes-frontend UI in headed Chromium
 * against a REAL regtest stack (bitcoind + electrs + ord) and a
 * REAL wallet extension (.crx unpacked into e2e/extensions/).
 *
 * They exist to prove, for every wallet in the picker, that a
 * user clicking through the form to a broadcast produces an
 * inscription that ord actually indexes. Not "the harness works",
 * "the button click works".
 *
 * Structural mirror of ordpool-sdk/e2e/playwright/playwright.config.ts.
 */
export default defineConfig({
  testDir: path.resolve(__dirname, 'specs'),
  globalSetup: path.resolve(__dirname, 'global-setup.ts'),

  // Extension state must not race: one worker, serial execution.
  fullyParallel: false,
  workers: 1,

  retries: 0,                // deliberate: a retry hides a real defect
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: WAIT_TIMEOUT_MS },

  use: {
    headless: false,         // extension injection requires headed
    screenshot: 'on',        // every step, every test: CI artifact trail
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: WAIT_TIMEOUT_MS,
    navigationTimeout: WAIT_TIMEOUT_MS,
  },

  outputDir: path.resolve(__dirname, '../../test-results-regtest'),
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.resolve(__dirname, '../../playwright-report-regtest') }],
  ],

  // The specs drive the cubes-frontend UI, so we need it up. Playwright spawns
  // the Angular dev server (regtest env). The funding-safety content scan hits
  // the REAL ord instances the docker stack brings up (stock ord and
  // cat21-ord), not a stub. Outside CI a server already on the port is reused.
  webServer: [
    {
      // Regtest-configured dev server. Swaps environment.ts for
      // environment.regtest.ts, whose URLs and proxy targets are the slot's
      // stack (scripts/write-regtest-stack.mjs runs before the serve), and
      // whose tip address is a regtest bcrt1p…
      command: `npm run start:regtest -- --port ${APP_PORT}`,
      cwd: path.resolve(__dirname, '../..'),
      port: APP_PORT,
      reuseExistingServer: !process.env.CI,
      // Server start, not a wait inside a test: a cold Angular build with no
      // `.angular/cache` measured past three minutes here, and clearing that
      // cache is the documented fix for a stale SDK prebundle, so the slow
      // case is a normal one.
      timeout: 420_000,
    },
  ],
});
