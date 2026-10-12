import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';

import {
  installXverseOfflineRoutes,
  launchWalletContext,
  onboardXverse,
  overrideRegtestElectrsUrl,
  primeAndSwitchToRegtest,
  regtestServiceUrls,
  waitForChromeStorageKey,
  waitForSingletonLockGone,
} from 'ordpool-sdk/e2e';

/**
 * Playwright globalSetup, runs ONCE before any spec.
 *
 * Inscribes the regtest fixtures, then runs the full Xverse onboarding
 * click-through once and keeps the resulting Chromium user-data-dir; the xverse
 * spec clones that seed dir for a fresh context instead of repeating the
 * onboarding clicks. See `/Work/ordpool/WALLETS.md`, "HARD RULE: The Xverse
 * pattern is the gold standard".
 *
 * This click-through IS the source-of-truth for onboarding here: each CI
 * run is a fresh machine with no persisted seed cache, so globalSetup
 * re-runs the real onboarding every push and a wallet version bump that
 * breaks a selector fails it loudly. Locally the seed is reused while the
 * Xverse version it was made with is the one unpacked and its electrs URL is
 * this slot's; set XVERSE_FORCE_REONBOARD to re-run it anyway.
 *
 * The test seed is the well-known BIP-39 abandon×11 + about vector and
 * the password is public. Both are deliberately unsuited for production
 * use.
 */

const EXT_PATH = path.resolve(__dirname, './extensions/xverse');
// The seed lives OUTSIDE Playwright's outputDir. Playwright clears that
// directory at the start of every run, so a cache kept there is gone before
// the guard below can read it, and each local run re-pays a headed onboarding
// that only has to happen once.
const SEED_CACHE_DIR = path.resolve(__dirname, './.xverse-seed');
// Seeded chromium user-data-dir: the xverse spec clones this so it gets a
// fresh context without the onboarding click flow.
export const SEED_USER_DATA_DIR = process.env.XVERSE_SEED_USER_DATA_DIR
  ?? path.join(SEED_CACHE_DIR, 'xverse-seed-user-data-dir');
/**
 * The Xverse version the seed was made with and the electrs URL it was pointed
 * at; either one different re-onboards. The URL is part of the key because it
 * is written into the wallet's own storage and differs per stack slot, so a
 * seed made against another slot would broadcast to that slot's electrs.
 */
const SEED_MARKER = path.join(SEED_CACHE_DIR, 'xverse-seed-key');

export default async function globalSetup(): Promise<void> {
  // Inscribe the fixture bytes on THIS chain and write their ids to
  // src/environments/regtest-inscriptions.generated.ts, which both the regtest
  // environment and the spec helpers read. It has to run here rather than only
  // in regtest-bootstrap.sh: a Playwright run never calls that script, so ids
  // written against an earlier chain survive a `down -v` and every one of them
  // 404s, which disables the Mint button and reads as a product regression.
  // The script exits early when the ids it already wrote still resolve.
  execFileSync(path.resolve(__dirname, 'inscribe-fixtures.sh'), { stdio: 'inherit' });

  // The seed is Xverse-specific: only the xverse spec clones it. Every other
  // wallet's matrix job runs without the xverse .crx unpacked, so a hard throw
  // here would break those jobs for no reason. Skipped; if the xverse spec runs
  // without the extension, IT throws a targeted error.
  if (!fs.existsSync(path.join(EXT_PATH, 'manifest.json'))) {
    console.log(`[globalSetup] Xverse extension not present at ${EXT_PATH}, skipping seed onboarding (only needed by the xverse spec).`);
    return;
  }

  const extVersion = (JSON.parse(fs.readFileSync(path.join(EXT_PATH, 'manifest.json'), 'utf8')) as { version: string }).version;
  // Point Xverse's Regtest network at the slot's electrs the mint spec hits.
  // Without this override Xverse would broadcast against its own default
  // regtest esplora.
  const electrsUrl = regtestServiceUrls().electrs;
  const seedKey = `${extVersion} ${electrsUrl}`;
  if (
    fs.existsSync(path.join(SEED_USER_DATA_DIR, 'Default')) &&
    fs.existsSync(SEED_MARKER) &&
    fs.readFileSync(SEED_MARKER, 'utf8') === seedKey &&
    !process.env.XVERSE_FORCE_REONBOARD
  ) {
    console.log(`[globalSetup] reusing seed user-data-dir (Xverse ${extVersion}, electrs ${electrsUrl}) at ${SEED_USER_DATA_DIR}`);
    return;
  }

  console.log('[globalSetup] onboarding Xverse + switching to Regtest…');
  fs.rmSync(SEED_USER_DATA_DIR, { recursive: true, force: true });
  fs.rmSync(SEED_MARKER, { force: true });
  fs.mkdirSync(SEED_USER_DATA_DIR, { recursive: true });
  const context = await launchWalletContext({
    wallet: 'xverse',
    extensionPath: EXT_PATH,
    userDataDir: SEED_USER_DATA_DIR,
  });
  await installXverseOfflineRoutes(context);

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = worker.url().split('/')[2];

  try {
    await onboardXverse(context, extensionId);
    await primeAndSwitchToRegtest(context, extensionId);
    await overrideRegtestElectrsUrl(context, extensionId, electrsUrl);
    console.log(`[globalSetup] overrode bitcoin-regtest.electrsApiUrl = ${electrsUrl}`);
    // Gate the close on the wallet state having materialised in
    // chrome.storage.local: it confirms LevelDB flushed the final writes of
    // primeAndSwitchToRegtest. Without this gate, the cloned user-data-dir
    // misses the last writes and the wallet appears un-onboarded to the spec.
    await waitForChromeStorageKey({ context, keyContains: 'walletState' });
  } finally {
    await context.close();
  }
  // After close, wait for Chrome to release its singleton lock so the spec
  // can safely clone the user-data-dir.
  await waitForSingletonLockGone(SEED_USER_DATA_DIR);
  fs.writeFileSync(SEED_MARKER, seedKey);
}
