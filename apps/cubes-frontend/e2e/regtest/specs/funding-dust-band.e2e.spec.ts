/**
 * @test-kind e2e
 * Real:   cubes app on the Angular dev server (ng serve -c regtest), regtest stack (bitcoind
 *         30, ordpool-electrs, cat21-ord, stock ord, ordpool-backend); no wallet extension, a
 *         per-run watch-only xpub account
 * Faked:  nothing
 * Proves: a coin just above the measured funding requirement is reported as over-paying, by
 *         the folded amount
 */
import { test, expect, chromium, Browser, Page } from '@playwright/test';
import { randomBytes } from '@noble/hashes/utils';

import {
  changeDustFloor,
  getDummyKeypair,
  Network,
  prepareInscribeFundingInput,
  simulateInscribeFees,
  toScureNetwork,
} from 'ordpool-sdk';
import {
  makeWatchOnlyTestAccount,
  seedDirtyCoin,
  fundCommonSats,
  mineBlocks,
  rpc,
  waitForElectrsSync,
  waitForUtxoAt,
  installContextErrorGuard,
  netLogArgs,
  offlineLaunchArgs,
  reachableHosts,
} from 'ordpool-sdk/e2e';
import {
  connectWatchOnly,
  CUBES_URL,
  fillCubeSides,
  expectedRegtestCubeHtml,
  openDetails,
  openMintCheckout,
  RENDERABLE_SIDE_IDS,
} from '../regtest-helpers';

/**
 * The THIRD funding state: a coin that can fund AND over-pays.
 *
 * Between "this coin works" and "this coin cannot pay" sits the dust-cliff
 * band. A coin barely above the funding requirement leaves change too small to
 * be worth its own output, so the commit folds that leftover into the miner fee
 * instead. The coin is usable and the reader is worse off for using it, which
 * neither of the other two states can express.
 *
 * Only the COMMIT can do this on the inscribe path. The reveal's fee is
 * reserved inside the commit output rather than funded by a coin whose change
 * could fall below dust, so there is exactly one fold to report and calling it
 * the commit's is the honest label.
 *
 * Sized from the MEASURED requirement plus half the change dust floor, so the
 * leftover lands under that floor by construction rather than by a number
 * someone guessed once and never re-checked.
 */

const CUBE_SIDE_IDS = RENDERABLE_SIDE_IDS;
const APP_FEE_RATE = 10;
const TIP_ADDRESS = 'bcrt1pgnmqsy3m04999vwvczfuuualuptlcwnlqx7yrf7y2xwzyswdxpvq92zqwq';
const TIP_SATS = 1000;
const ROOMY_SATS = 2_000_000;
const ROOMY_BTC = 0.02;

let browser: Browser;

test.beforeAll(async () => {
  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) {
    throw new Error(`regtest tip is ${tip} (<101). Run: bash e2e/regtest/regtest-bootstrap.sh`);
  }
  // No wallet extension, so no launchWalletContext, but the same switches it
  // passes: nothing but loopback and the regtest stack resolves, and with
  // ORDPOOL_E2E_NET_LOG_DIR set the net log records what the browser sent.
  browser = await chromium.launch({ args: [...offlineLaunchArgs(reachableHosts()), ...netLogArgs('funding-dust-band')] });
});

test.afterAll(async () => {
  await browser?.close();
});

test('funding-dust-band: a coin just above the requirement says it over-pays, and by how much', async () => {
  const account = makeWatchOnlyTestAccount({ seed: randomBytes(32) });
  const address = account.addressAt(0);

  // A roomy coin first, so the wallet can mint at all and the band coin is a
  // CHOICE rather than the only option.
  await fundCommonSats(address, ROOMY_BTC);
  await waitForUtxoAt(address, ROOMY_SATS);

  // Measure the requirement the same way the app does, through the prepared
  // simulation path, so the band is derived rather than guessed.
  const dummy = getDummyKeypair(toScureNetwork(Network.Regtest));
  const body = new TextEncoder().encode(expectedRegtestCubeHtml({
    inscriptionIds: {
      inscriptionId1: CUBE_SIDE_IDS[0], inscriptionId2: CUBE_SIDE_IDS[1],
      inscriptionId3: CUBE_SIDE_IDS[2], inscriptionId4: CUBE_SIDE_IDS[3],
      inscriptionId5: CUBE_SIDE_IDS[4], inscriptionId6: CUBE_SIDE_IDS[5],
    },
    title: '', rotationSpeedX: '', rotationSpeedY: '',
    colorPane: '', bgColor1: '', bgColor2: '',
  } as never));
  const { fundingRequirementSats } = simulateInscribeFees({
    feeRatePerVbyte: APP_FEE_RATE,
    body,
    contentType: 'text/html;charset=utf-8',
    fundingInput: prepareInscribeFundingInput({
      utxo: { txid: 'a'.repeat(64), vout: 0, value: ROOMY_SATS, status: { confirmed: true } },
      paymentPublicKey: account.p2trAt(0).tapInternalKey,
      paymentAddress: address,
      isSimulation: true,
      network: Network.Regtest,
    } as never),
    senderChangeAddress: address,
    recipientAddress: address,
    ephemeralPubkeyXonly: dummy.xOnlyDummyPublicKey,
    network: 'regtest',
    // The tip is part of what the coin must cover, so a simulation without it
    // measures a DIFFERENT flow: 4 866 instead of 6 296, and a "band" coin
    // sized from it cannot fund the real mint at all.
    tip: { address: TIP_ADDRESS, value: TIP_SATS },
  } as never);

  const floor = changeDustFloor(address);
  const bandSats = (fundingRequirementSats as number) + Math.floor(floor / 2);
  const band = await seedDirtyCoin({ asset: 'inscription', address, valueSats: bandSats });
  expect(band.value).toBe(bandSats);
  await waitForElectrsSync(mineBlocks(1));

  const context = await browser.newContext();
  // Fails the test on any console.error or uncaught exception from a page of this context.
  const errorGuard = installContextErrorGuard(context);
  const page: Page = await context.newPage();

  await page.goto(CUBES_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="page-title"]')).toBeVisible();
  await connectWatchOnly(page, account.accountExtendedPublicKey);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="page-title"]')).toBeVisible();
  await openDetails(page, 'configurator-advanced');
  await fillCubeSides(page, CUBE_SIDE_IDS);

  await openMintCheckout(page);
  await openDetails(page, 'mint-advanced');
  await openDetails(page, 'mint-expert-details');

  // Wait for the picker to HAVE rows before reading them: querying straight
  // after opening samples an empty list and reports the badge missing, which
  // looks like the feature is absent rather than not rendered yet.
  await expect(page.locator('[data-testid^="mint-expert-row-"]').first()).toBeVisible();

  const overpay = page.locator('[data-testid="mint-row-overpay"]').first();
  await expect(
    overpay,
    `a coin at ${bandSats} sat (measured requirement ${fundingRequirementSats} + half the ${floor}-sat dust floor) must land in the fold band`,
  ).toBeVisible();

  // The AMOUNT, not just the badge. The fold is the difference between this
  // coin's realised fee and a roomy coin's, so asserting it names a real
  // quantity rather than "something was flagged".
  const folded = Math.floor(floor / 2);
  await expect(overpay).toContainText(`over-pays ${folded}`);

  errorGuard.assertClean();
  await context.close();
});
