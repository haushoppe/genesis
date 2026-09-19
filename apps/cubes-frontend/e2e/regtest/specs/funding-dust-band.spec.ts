import { test, expect, chromium, Browser, Page } from '@playwright/test';
import { HDKey } from '@scure/bip32';
import * as btc from '@scure/btc-signer';
import { randomBytes } from '@noble/hashes/utils';

import {
  changeDustFloor,
  getDummyKeypair,
  Network,
  prepareInscribeFundingInput,
  simulateInscribeFees,
  toScureNetwork,
} from 'ordpool-sdk';
import { seedDirtyCoin } from 'ordpool-sdk/e2e';
import {
  fundCommonSats,
  isExpectedConsoleError,
  mineBlocks,
  fillCubeSides,
  openDetails,
  openMintCheckout,
  RENDERABLE_SIDE_IDS,
  rpc,
  waitForElectrsSync,
  waitForUtxoAt,
} from '../regtest-helpers';
import { getCubeHtml } from '../../../src/app/services/cube-html';

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

const REGTEST = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };
const TESTNET_VERSIONS = { private: 0x04358394, public: 0x043587cf };
const ACCOUNT_PATH = "m/86'/1'/0'";
const APP_URL = 'http://localhost:4203/';
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
  browser = await chromium.launch();
});

test.afterAll(async () => {
  await browser?.close();
});

test('funding-dust-band: a coin just above the requirement says it over-pays, and by how much', async () => {
  test.setTimeout(240_000);

  const master = HDKey.fromMasterSeed(randomBytes(32), TESTNET_VERSIONS);
  const account = master.derive(ACCOUNT_PATH);
  const leaf = account.derive('m/0/0');
  const address = btc.p2tr(leaf.publicKey!.slice(1, 33), undefined, REGTEST).address!;

  // A roomy coin first, so the wallet can mint at all and the band coin is a
  // CHOICE rather than the only option.
  await fundCommonSats(address, ROOMY_BTC);
  await waitForUtxoAt(address, ROOMY_SATS);

  // Measure the requirement the same way the app does, through the prepared
  // simulation path, so the band is derived rather than guessed.
  const dummy = getDummyKeypair(toScureNetwork(Network.Regtest));
  const body = new TextEncoder().encode(getCubeHtml({
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
      paymentPublicKey: leaf.publicKey!,
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

  const page: Page = await browser.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !isExpectedConsoleError(m.text(), m.location().url)) errors.push(m.text());
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="wallet-connect-btn"]').click();
  await expect(page.locator('[data-testid="wallet-picker-list"]')).toBeVisible({ timeout: 10_000 });
  await page.locator('[data-testid="wallet-connect-xpub"]').click();
  await expect(page.locator('[data-testid="wallet-xpub-form"]')).toBeVisible();
  await page.locator('[data-testid="wallet-xpub-input"]').fill(account.publicExtendedKey);
  await page.locator('[data-testid="wallet-xpub-connect"]').click();
  const scriptType = page.locator('[data-testid="wallet-xpub-script-type"]');
  await scriptType.waitFor({ state: 'visible', timeout: 15_000 });
  await scriptType.selectOption('p2tr');
  await page.locator('[data-testid="wallet-xpub-connect"]').click();
  await expect(page.locator('[data-testid="wallet-connected-address"]')).toBeVisible({ timeout: 30_000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });
  await openDetails(page, 'configurator-advanced');
  await fillCubeSides(page, CUBE_SIDE_IDS);

  await openMintCheckout(page);
  await openDetails(page, 'mint-advanced');
  await openDetails(page, 'mint-expert-details');

  // Wait for the picker to HAVE rows before reading them: querying straight
  // after opening samples an empty list and reports the badge missing, which
  // looks like the feature is absent rather than not rendered yet.
  await expect(page.locator('[data-testid^="mint-expert-row-"]').first()).toBeVisible({ timeout: 30_000 });

  const overpay = page.locator('[data-testid="mint-row-overpay"]').first();
  await expect(
    overpay,
    `a coin at ${bandSats} sat (measured requirement ${fundingRequirementSats} + half the ${floor}-sat dust floor) must land in the fold band`,
  ).toBeVisible({ timeout: 30_000 });

  // The AMOUNT, not just the badge. The fold is the difference between this
  // coin's realised fee and a roomy coin's, so asserting it names a real
  // quantity rather than "something was flagged".
  const folded = Math.floor(floor / 2);
  await expect(overpay).toContainText(`over-pays ${folded}`);

  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  await page.close();
});
