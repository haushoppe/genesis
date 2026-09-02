import { chromium, BrowserContext } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { waitForChromeStorageKey, waitForSingletonLockGone } from './wait-helpers';
import { onboardXverse, primeAndSwitchToRegtest, overrideRegtestElectrsUrl } from 'ordpool-sdk/e2e';

/**
 * Playwright globalSetup — runs ONCE before any spec.
 *
 * SPEED OPTIMIZATION LAYER of the Xverse gold-standard pattern.
 * See `/Work/ordpool/WALLETS.md` → "HARD RULE: The Xverse pattern is
 * the gold standard" for the full mental model. The TL;DR: this file
 * runs the FULL onboarding click-through once and caches the result;
 * the per-wallet cube-mint-roundtrip specs clone the seed dir for fresh
 * contexts in <2s instead of repeating 25s of UI clicks.
 *
 * This click-through IS the source-of-truth for onboarding here: each CI
 * run is a fresh machine with no persisted seed cache, so globalSetup
 * re-runs the real onboarding every push and a wallet version bump that
 * breaks a selector fails it loudly. Locally the seed cache persists on
 * disk, so delete it to re-exercise onboarding after a wallet bump.
 *
 * Drives the full Xverse onboarding (BIP-39 test seed + password)
 * and switches the wallet to Bitcoin Regtest mode, then dumps the
 * extension's `chrome.storage.local` to a JSON file. Specs read
 * that file in their beforeAll and restore it into a fresh
 * Chromium context, skipping the 25s click flow per spec.
 *
 * Dump path:
 *   process.env.XVERSE_STORAGE_DUMP
 *   ?? path.resolve(__dirname, '../../test-results-regtest/xverse-storage.json')
 *
 * The test seed is the well-known BIP-39 abandon×11 + about
 * vector and the password is publicly checked into this file.
 * Both are deliberately unsuited for production use — the
 * resulting wallet is observable by anyone with the dump.
 */

const EXT_PATH = path.resolve(__dirname, './extensions/xverse');
const DUMP_PATH = process.env.XVERSE_STORAGE_DUMP
  ?? path.resolve(__dirname, '../../test-results-regtest/xverse-storage.json');
// Seeded chromium user-data-dir — specs clone this per-test so each
// gets a fresh context but skip the onboarding click flow.
export const SEED_USER_DATA_DIR = process.env.XVERSE_SEED_USER_DATA_DIR
  ?? path.resolve(__dirname, '../../test-results-regtest/xverse-seed-user-data-dir');

async function dumpStorage(context: BrowserContext, extensionId: string): Promise<Record<string, unknown>> {
  // chrome.storage.local is only available from extension-origin
  // pages. Open a fresh extension page, evaluate get(null) to grab
  // every key.
  const dumper = await context.newPage();
  await dumper.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  // Settle on a Xverse boot marker (unlock screen text or the
  // already-unlocked account heading) rather than a fixed sleep —
  // chrome.storage.local writes flush deterministically by the time
  // the UI has finished hydrating from them.
  await dumper.waitForFunction(() => {
    const t = (document.body.innerText || '').toLowerCase();
    return t.includes('unlock') || t.includes('account 1') || t.includes('zest');
  }, undefined, { timeout: 30_000, polling: 250 });
  const data = await dumper.evaluate(() => new Promise<Record<string, unknown>>((resolve) => {
    (window as unknown as { chrome: { storage: { local: { get: (k: null, cb: (v: Record<string, unknown>) => void) => void } } } })
      .chrome.storage.local.get(null, (v) => resolve(v));
  }));
  await dumper.close();
  return data;
}

export default async function globalSetup(): Promise<void> {
  // globalSetup is Xverse-specific: it clones a onboarded seed
  // user-data-dir the xverse spec reuses. Every other wallet's
  // matrix job runs without the xverse .crx unpacked, so a hard
  // throw here would break cat21wallet / alby / leather / … jobs
  // for no reason. Soft-skip; if the xverse spec runs without the
  // extension, IT throws a targeted error.
  if (!fs.existsSync(path.join(EXT_PATH, 'manifest.json'))) {
    console.log(`[globalSetup] Xverse extension not present at ${EXT_PATH} — skipping seed onboarding (only needed by the xverse spec).`);
    return;
  }

  // Skip re-onboarding if the seed dir + dump already exist from
  // a previous run with the same Xverse version. Saves ~25s on
  // local re-runs.
  if (
    fs.existsSync(DUMP_PATH) &&
    fs.existsSync(path.join(SEED_USER_DATA_DIR, 'Default')) &&
    !process.env.XVERSE_FORCE_REONBOARD
  ) {
    // eslint-disable-next-line no-console
    console.log(`[globalSetup] reusing existing seed user-data-dir at ${SEED_USER_DATA_DIR}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[globalSetup] onboarding Xverse + switching to Regtest…`);
  fs.rmSync(SEED_USER_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(SEED_USER_DATA_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(SEED_USER_DATA_DIR, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 30_000 });
  const extensionId = worker.url().split('/')[2];

  try {
    await onboardXverse(context, extensionId);
    await primeAndSwitchToRegtest(context, extensionId);
    // Point Xverse's Regtest network at the local electrs the
    // mint-roundtrip spec hits. Without this override Xverse would
    // try to broadcast against sBTC mempool. The override is
    // ignored by the address-handshake spec (it only does
    // getAddress, no API calls) but matters for signTransaction.
    const electrsUrl = process.env.XVERSE_REGTEST_ELECTRS_URL ?? 'http://localhost:3000';
    await overrideRegtestElectrsUrl(context, extensionId, electrsUrl);
    // eslint-disable-next-line no-console
    console.log(`[globalSetup] overrode bitcoin-regtest.electrsApiUrl = ${electrsUrl}`);
    const dump = await dumpStorage(context, extensionId);

    fs.mkdirSync(path.dirname(DUMP_PATH), { recursive: true });
    fs.writeFileSync(DUMP_PATH, JSON.stringify(dump, null, 2));
    // eslint-disable-next-line no-console
    console.log(`[globalSetup] dumped ${Object.keys(dump).length} keys to ${DUMP_PATH}`);
    // Gate the close on the dumped state having actually materialised
    // in chrome.storage.local — confirms LevelDB flushed the final
    // writes from primeAndSwitchToRegtest. Without this gate, the
    // cloned user-data-dir misses the last few writes and the wallet
    // appears un-onboarded to specs launched from the clone.
    await waitForChromeStorageKey({ context, keyContains: 'walletState', timeoutMs: 30_000 });
  } finally {
    await context.close();
  }
  // After close, wait for Chrome to release its singleton lock so
  // downstream tests can safely clone the user-data-dir.
  await waitForSingletonLockGone(SEED_USER_DATA_DIR).catch(() => undefined);
}
