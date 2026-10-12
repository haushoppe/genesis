/**
 * @test-kind e2e
 * Real:   cubes app on the Angular dev server (ng serve -c regtest), regtest stack (bitcoind
 *         30, ordpool-electrs, cat21-ord, stock ord, ordpool-backend); cubes minted by the
 *         SDK's InscribeMintOrchestrator signed by a per-run watch-only account
 *         (makeWatchOnlyTestAccount); the cubes index built from them by ordinal-cubes-index's
 *         grind.mjs and rarity.mjs at the pinned sha (build-cubes-index.sh)
 * Faked:  nothing
 * Proves: a cube's detail page loads from the index, ArrowRight and ArrowLeft move to the
 *         older and the newer neighbour, and ArrowRight on the start page moves the cube list
 *         to its second page, each landing on the exact cube the mint order puts there
 */
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from '@noble/hashes/utils';
import {
  deriveWatchOnlyAddresses,
  esploraInscribeTransport,
  InscribeMintOrchestrator,
  InscribeSnapshot,
  KnownOrdinalWalletType,
  Network,
  UtxoContentScanner,
} from 'ordpool-sdk';
import {
  fundCommonSats,
  getUtxos,
  installContextErrorGuard,
  launchOfflineBrowser,
  makeWatchOnlyTestAccount,
  mineBlocks,
  regtestServiceUrls,
  rpc,
  waitForElectrsSync,
  waitForOrdStockInscription,
  waitForOrdStockSync,
  waitForOrdSync,
  type WatchOnlyTestAccount,
} from 'ordpool-sdk/e2e';

import { environment as regtestEnvironment } from '../../../src/environments/environment.regtest';
import { CUBES_URL, expectedRegtestCubeHtml, RENDERABLE_SIDE_IDS } from '../regtest-helpers';

/**
 * One more cube than the start page lists per page (12), so the list has a
 * second page and that page holds exactly the oldest cube.
 */
const CUBE_COUNT = 13;

/** The cube whose detail page the navigation starts from: both neighbours exist. */
const MIDDLE = 6;

/** Covers every mint: each one spends the previous one's change. */
const FUND_BTC = 0.01;

const INDEX_DIR = path.resolve(__dirname, '../.cubes-index/data');
const BUILD_INDEX = path.resolve(__dirname, '../build-cubes-index.sh');

/**
 * The ids this lane minted on the current chain. A failed test restarts the
 * worker and runs `beforeAll` again; minting a second set there would change
 * the index under the remaining tests, so a set that still exists on this
 * chain is reused.
 */
const MINTED_IDS = path.resolve(__dirname, '../.cubes-index/cube-navigation.json');

const urls = regtestServiceUrls();

/** Inscription ids of the minted cubes, in mint order (index 0 is the oldest). */
const cubeIds: string[] = [];

let browser: Browser;

// App-specific: a cube body for regtest, the six fixture sides rotated by `n`
// so no cube repeats a side, titled so its index name is predictable.
function cubeBody(n: number): Uint8Array {
  const sides = RENDERABLE_SIDE_IDS.map((_, i) => RENDERABLE_SIDE_IDS[(i + n) % RENDERABLE_SIDE_IDS.length]);
  return new TextEncoder().encode(expectedRegtestCubeHtml({
    inscriptionIds: {
      inscriptionId1: sides[0],
      inscriptionId2: sides[1],
      inscriptionId3: sides[2],
      inscriptionId4: sides[3],
      inscriptionId5: sides[4],
      inscriptionId6: sides[5],
    },
    title: `Navigation ${n}`,
    rotationSpeedX: '',
    rotationSpeedY: '',
    colorPane: '',
    bgColor1: '',
    bgColor2: '',
  }));
}

/** The name the index gives the n-th cube: its position, then its title. */
const cubeName = (n: number) => `Ordinal Cube #${n} (Navigation ${n})`;

/**
 * Mint one cube the way the app does: the SDK's inscribe orchestrator with the
 * app's ports (electrs UTXOs, the ord content scan, the esplora package
 * transport), funded from a watch-only account whose commit PSBT is signed
 * outside, as the watch-only path signs it. Mines the commit and the reveal,
 * so every cube sits in its own block and the mint order is the index order.
 */
async function mintCube(
  account: WatchOnlyTestAccount,
  identity: { address: string; publicKeyHex: string },
  n: number,
): Promise<string> {
  const orch = new InscribeMintOrchestrator({
    getUtxos: (address) => getUtxos(address),
    scan: new UtxoContentScanner({
      mempoolApiUrl: urls.electrs,
      cat21ApiUrl: urls.electrs,
      ordApiUrl: urls.ordStock,
      cat21OrdApiUrl: urls.ord,
    }),
    transport: esploraInscribeTransport([urls.electrs]),
    network: Network.Regtest,
    fundingTopology: 'derive',
  });
  await orch.setWallet({
    type: KnownOrdinalWalletType.xpub,
    ordinalsAddress: identity.address,
    paymentAddress: identity.address,
    paymentPublicKey: identity.publicKeyHex,
  });
  orch.setFeeRate(2);
  const ready = await new Promise<InscribeSnapshot>((resolve, reject) => {
    const unsub = orch.subscribe((s) => {
      const status = s.fundingRecommendation.status;
      if (s.state === 'error') {
        unsub();
        reject(new Error(`cube ${n}: orchestrator error: ${s.errorMessage}`));
      } else if (s.simulations.length > 0 && status !== 'scanning') {
        unsub();
        resolve(s);
      }
    });
    orch.setContent({
      source: { kind: 'file', body: cubeBody(n), contentType: 'text/html;charset=utf-8' },
      tip: { address: regtestEnvironment.haushoppeTipAddress, value: regtestEnvironment.haushoppeTipSats },
    });
  });
  if (ready.fundingRecommendation.status !== 'auto') {
    throw new Error(`cube ${n}: funding is ${ready.fundingRecommendation.status}, expected a clean coin to auto-pick`);
  }

  const { revealTxId } = await orch.mint(async ({ base64 }) => account.signExportedPsbt(base64));
  const tip = mineBlocks(1);
  await waitForElectrsSync(tip);
  await waitForOrdStockSync(tip);
  // The next mint scans its change on both ords; cat21-ord must have the block too.
  await waitForOrdSync(tip);
  const id = `${revealTxId}i0`;
  await waitForOrdStockInscription(id);
  return id;
}

/** The ids recorded by an earlier `beforeAll` when every one is on this chain, else null. */
async function mintedOnThisChain(): Promise<string[] | null> {
  if (!fs.existsSync(MINTED_IDS)) return null;
  const ids = JSON.parse(fs.readFileSync(MINTED_IDS, 'utf8')) as string[];
  for (const id of ids) {
    const res = await fetch(`${urls.ordStock}/inscription/${id}`, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`ord answered ${res.status} for ${id}`);
  }
  return ids.length === CUBE_COUNT ? ids : null;
}

test.beforeAll(async () => {
  const height = Number(rpc('getblockcount').trim());
  if (height < 101) {
    throw new Error(`regtest tip is ${height} (<101). Run: bash e2e/regtest/regtest-bootstrap.sh`);
  }

  const account = makeWatchOnlyTestAccount({ seed: randomBytes(32) });
  // The identity the app's own watch-only connect derives from the account key.
  const [identity] = deriveWatchOnlyAddresses({
    extendedPublicKey: account.accountExtendedPublicKey,
    network: Network.Regtest,
    scriptType: 'p2tr',
    count: 1,
  });
  expect(identity.address).toBe(account.addressAt(0));

  const minted = await mintedOnThisChain();
  if (minted) {
    cubeIds.push(...minted);
  } else {
    await fundCommonSats(identity.address, FUND_BTC);
    for (let n = 0; n < CUBE_COUNT; n++) {
      cubeIds.push(await mintCube(account, identity, n));
    }
    fs.writeFileSync(MINTED_IDS, JSON.stringify(cubeIds, null, 2) + '\n');
  }

  // The production indexer, run against this chain, picks the cubes up.
  execFileSync('bash', [BUILD_INDEX], { stdio: 'inherit' });
  const index = JSON.parse(fs.readFileSync(path.join(INDEX_DIR, 'cubes.json'), 'utf8')) as {
    inscriptionId: string;
    name: string;
  }[];
  // This lane owns its stack, so the index holds exactly the cubes minted here,
  // in mint order, named by position.
  expect(index.map((c) => c.inscriptionId)).toEqual(cubeIds);
  expect(index.map((c) => c.name)).toEqual(cubeIds.map((_, n) => cubeName(n)));

  // No wallet extension, so launchOfflineBrowser: the dead proxy is checked
  // first, nothing but loopback and the regtest stack resolves, and with
  // ORDPOOL_E2E_NET_LOG_DIR set the net log records what the browser sent.
  browser = await launchOfflineBrowser({ name: 'cube-navigation' });
});

test.afterAll(async () => {
  await browser?.close();
});

/** A fresh context with the browser-error guard, and one page in it. */
async function openPage(): Promise<{ context: BrowserContext; page: Page; assertClean: () => void }> {
  const context = await browser.newContext();
  const guard = installContextErrorGuard(context);
  const page = await context.newPage();
  return { context, page, assertClean: () => guard.assertClean() };
}

const detailUrl = (id: string) => new URL(`inscription/${id}`, CUBES_URL).href;

/** The detail page's heading, which carries the cube's index name. */
const heading = (page: Page) => page.locator('app-details h3');

test('cube-navigation: loads a known cube detail page', async () => {
  const { context, page, assertClean } = await openPage();
  await page.goto(detailUrl(cubeIds[MIDDLE]));

  await expect(heading(page)).toHaveText(cubeName(MIDDLE));
  await expect(page.locator(`app-details a[title="${cubeIds[MIDDLE]}"]`)).toBeVisible();
  await expect(page.locator('app-details iframe[apptoggleiframe]')).toBeAttached();

  assertClean();
  await context.close();
});

test('cube-navigation: ArrowRight navigates to the next cube', async () => {
  const { context, page, assertClean } = await openPage();
  await page.goto(detailUrl(cubeIds[MIDDLE]));
  await expect(heading(page)).toHaveText(cubeName(MIDDLE));

  // A cube's neighbours run newest first by mint order, so the next cube is
  // the one minted before it.
  const next = page.getByRole('link', { name: '» Next Cube' });
  await expect(next).toHaveAttribute('href', `/inscription/${cubeIds[MIDDLE - 1]}`);

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(detailUrl(cubeIds[MIDDLE - 1]));
  await expect(heading(page)).toHaveText(cubeName(MIDDLE - 1));

  assertClean();
  await context.close();
});

test('cube-navigation: ArrowLeft navigates to the previous cube', async () => {
  const { context, page, assertClean } = await openPage();
  await page.goto(detailUrl(cubeIds[MIDDLE]));
  await expect(heading(page)).toHaveText(cubeName(MIDDLE));

  // Previous is the newer neighbour, the one minted after.
  const previous = page.getByRole('link', { name: '« Previous Cube' });
  await expect(previous).toHaveAttribute('href', `/inscription/${cubeIds[MIDDLE + 1]}`);

  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(detailUrl(cubeIds[MIDDLE + 1]));
  await expect(heading(page)).toHaveText(cubeName(MIDDLE + 1));

  assertClean();
  await context.close();
});

test('cube-navigation: ArrowRight advances the cube list to the next page', async () => {
  const { context, page, assertClean } = await openPage();
  await page.goto(CUBES_URL);

  const total = page.getByTestId('minted-cubes-total');
  await expect(total).toHaveText(String(CUBE_COUNT));
  const tiles = page.locator('[data-testid="minted-cubes-grid"] a[href^="/inscription/"]');
  const tileHrefs = () => tiles.evaluateAll((links) => links.map((a) => a.getAttribute('href')));

  // The list's default order is the index's rarity rank, then the unranked
  // cubes newest first. Every cube here shows the same six fixture images, so
  // by the index's rules only the first one is scored and every later one is
  // cursed for reusing its sides (rarity.json). Page 1: cube 0, then cubes 12
  // down to 2.
  const href = (n: number) => `/inscription/${cubeIds[n]}`;
  const firstPage = [0, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map(href);
  await expect.poll(tileHrefs).toEqual(firstPage);
  await expect(page.locator('ngb-pagination .page-item.active')).toContainText('1');

  await page.keyboard.press('ArrowRight');

  // Page 2: the one cube left, cube 1.
  await expect(page).toHaveURL(new URL('?page=2', CUBES_URL).href);
  await expect(page.locator('ngb-pagination .page-item.active')).toContainText('2');
  await expect.poll(tileHrefs).toEqual([href(1)]);

  assertClean();
  await context.close();
});
