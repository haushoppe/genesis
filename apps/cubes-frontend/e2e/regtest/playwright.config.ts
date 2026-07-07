import { defineConfig } from '@playwright/test';
import * as path from 'node:path';

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

  retries: process.env.CI ? 2 : 0,
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

  // The specs drive the cubes-frontend UI, so we need it up. Playwright
  // spawns `npm start` (Angular dev server on :4203). CI reuses the
  // server if it's already running.
  webServer: {
    command: 'npm start',
    cwd: path.resolve(__dirname, '../..'),
    port: 4203,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
