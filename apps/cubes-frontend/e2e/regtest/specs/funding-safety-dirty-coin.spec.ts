import { test, expect, chromium, Browser, Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { base64 } from '@scure/base';
import { HDKey } from '@scure/bip32';
import * as btc from '@scure/btc-signer';
import { randomBytes } from '@noble/hashes/utils';

import {
  fundCommonSats,
  mineBlocks,
  fillCubeSides,
  expectedRegtestCubeHtml,
  openDetails,
  openMintCheckout,
  RENDERABLE_SIDE_IDS,
  rpc,
  getUtxos,
  waitForElectrsSync,
  waitForTxConfirmed,
  waitForUtxoAt,
} from '../regtest-helpers';
import { clickUntilEffect, seedDirtyCoin, assertDirtyCoinIsBestFit, type DirtyCoinAsset } from 'ordpool-sdk/e2e';
import { simulateInscribeFees, prepareInscribeFundingInput, changeDustFloor, Network } from 'ordpool-sdk';

/**
 * The funding-safety guard, proven by watching a coin NOT get spent.
 *
 * A cube mint funds itself from the wallet's payment pool. If that pool holds a
 * coin carrying an inscription, a cat, a rune balance or a rare sat, spending it
 * destroys or transfers the asset, and the loss is permanent and uninsurable.
 * The SDK's `recommendFunding` exists to refuse such a coin. Whether CUBES
 * reaches it is a separate question, and this is the spec that answers it:
 * the guard lives in the SDK, the wiring lives here.
 *
 * WHY A SUITE FULL OF CLEAN COINS PROVES NOTHING. Every other spec here funds
 * with freshly mined, asset-free coins, so the guard never engages and the suite
 * passes identically whether the guard works or was deleted. Three ways such a
 * spec can look rigorous and prove nothing, all three observed in this family:
 *
 *   1. Every coin is clean, so the guard never has a decision to make.
 *   2. The dirty coin is bigger than any plausible pick, so selection would
 *      never have taken it regardless. (The SDK's inscription seeder defaulted
 *      to 2 000 000 sats, which best-fit could not choose: a test built on it
 *      would pass with the guard removed.) `assertDirtyCoinIsBestFit` below
 *      fails at setup rather than letting that pass silently.
 *   3. The dirty coin is the ONLY coin, so there is nothing to steer to. That
 *      proves the guard FLAGS a coin, not that selection AVOIDS it.
 *
 * So the shape here is deliberate: the dirty coin is the SMALLEST covering
 * candidate, which is exactly what ord's best-fit selection reaches for first,
 * and a clean coin sits well above it as the correct alternative. An unguarded
 * selection takes the dirty one. The assertion reads the commit transaction's
 * real inputs off the chain and requires the dirty outpoint to be absent.
 *
 * The mutation that makes this evidence rather than decoration: neutralise
 * `recommendFunding` in the installed SDK and the dirty coin gets spent, per
 * asset class. Recorded in the commit that added this file.
 */

const REGTEST = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };
const TESTNET_VERSIONS = { private: 0x04358394, public: 0x043587cf };
const ACCOUNT_PATH = "m/86'/1'/0'";
const APP_URL = 'http://localhost:4203/';
const CUBE_SIDE_IDS = RENDERABLE_SIDE_IDS;

/**
 * The clean coin sits well above any funding requirement; the dirty coin sits
 * just above it. Best-fit takes the SMALLEST covering coin, so these two values
 * are what make the dirty one the candidate an unguarded selection picks.
 * If a future fee change lifts the requirement above DIRTY_SATS the dirty coin
 * stops being a candidate and this spec quietly stops proving anything, which
 * is why the mutation below is part of the contract and not a one-off.
 */
const CLEAN_SATS = 2_000_000;
const CLEAN_BTC = 0.02;

/**
 * The app's own initial fee rate and tip. The simulation below has to describe
 * the SAME flow the spec then runs, or it measures the requirement of a
 * different mint.
 */
const APP_FEE_RATE = 10;
const TIP_ADDRESS = 'bcrt1pgnmqsy3m04999vwvczfuuualuptlcwnlqx7yrf7y2xwzyswdxpvq92zqwq';
const TIP_SATS = 1000;
/**
 * Any value that COVERS the funding requirement and is the smallest covering
 * coin in the pool. Measured, not guessed: `simulateInscribeFees` reports the
 * requirement at 6 296 sats for a cube body at this fee rate, so both this and
 * the 60 000 tried earlier qualify, and the premise assertion below proves it
 * per run rather than trusting the number.
 *
 * Correcting a claim this file used to make: 60 000 was NOT too small to be a
 * candidate. That green came from the Angular dev server's prebundle cache
 * serving the un-mutated guard, so the mutation never ran at all. With the
 * cache cleared, a 60 000 dirty coin IS spent by an unguarded selection. The
 * size was never the problem; the unapplied mutation was.
 */
const DIRTY_SATS = 300_000;

const ASSETS: DirtyCoinAsset[] = ['cat', 'inscription', 'rune', 'rareSat'];

/** Outside Playwright's outputDir, which is wiped at the start of every run. */
const STATE_SHOTS = path.resolve(__dirname, '../.state-screenshots');

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

for (const asset of ASSETS) {
  // The title carries the matrix value verbatim: CI runs each lane as
  // `--grep "<matrix value>"`, so a title that does not contain it is a spec
  // that only ever runs on someone's laptop.
  test(`funding-safety: a coin carrying ${asset} is never spent to fund a mint`, async () => {
    test.setTimeout(360_000);

    // A fresh account per asset: no leftover coin from a previous case can
    // stand in for the clean one, and no previous dirty coin can be the thing
    // that survives.
    const master = HDKey.fromMasterSeed(randomBytes(32), TESTNET_VERSIONS);
    const account = master.derive(ACCOUNT_PATH);
    const accountTpub = account.publicExtendedKey;
    const leaf = account.derive('m/0/0');
    const address = btc.p2tr(leaf.publicKey!.slice(1, 33), undefined, REGTEST).address!;

    // The clean coin first, so the wallet is fundable on its own merits.
    await fundCommonSats(address, CLEAN_BTC);
    await waitForUtxoAt(address, CLEAN_SATS);

    // The dirty coin, at a size an unguarded best-fit selection would prefer.
    const dirty = await seedDirtyCoin({ asset, address, valueSats: DIRTY_SATS });
    expect(dirty.value, 'the seeder must honour the size that makes this a candidate').toBe(DIRTY_SATS);
    await waitForElectrsSync(mineBlocks(1));

    // MEASURE the requirement, do not reason about it. The funding input is
    // built by `prepareInscribeFundingInput` with `isSimulation: true`, and
    // THAT is the load-bearing part: a hand-built input literal makes
    // `simulateInscribeFees` throw "No taproot scripts signed", whatever key it
    // carries. A dummy keypair appears to fix it only because its key matches
    // the simulator's own signer, which hides the real defect. The wallet's
    // REAL key works here, and returns the same 6 296 sats.
    // `fundingRequirementSats`
    // is commit output + commit fee, i.e. postage + reveal fee + tip + the
    // commit's own fee. It does not depend on the funding coin's VALUE (the
    // commit's vsize turns on the input's script type), so a dummy input shaped
    // like this wallet's P2TR payment address answers the same number the real
    // coin would.
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
        utxo: { txid: dirty.txid, vout: dirty.vout, value: dirty.value, status: { confirmed: true } },
        paymentPublicKey: leaf.publicKey!,
        paymentAddress: address,
        isSimulation: true,
        network: Network.Regtest,
      } as never),
      senderChangeAddress: address,
      recipientAddress: address,
      ephemeralPubkeyXonly: leaf.publicKey!.slice(1, 33),
      network: 'regtest',
      tip: { address: TIP_ADDRESS, value: TIP_SATS },
    } as never);

    // The premise, asserted instead of assumed: this coin has to be the one an
    // unguarded best-fit selection would take. If it is not, the mutation goes
    // green and the spec proves nothing, which is what happened at 60 000.
    const pool = [
      { txid: dirty.txid, vout: dirty.vout, value: dirty.value },
      ...(await getUtxos(address))
        .filter((u) => !(u.txid === dirty.txid && u.vout === dirty.vout))
        .map((u) => ({ txid: u.txid, vout: u.vout, value: u.value })),
    ];
    // The 4th argument mirrors selection's CHANGE-HEADROOM target, which it
    // prefers whenever any candidate clears it. Without it a coin sized between
    // the two targets passes this guard while never being a candidate, and the
    // resulting green reads as a protection that does not exist. Inscribe's two
    // targets sit further apart than a mint's, so the gap is wider here.
    const preferred = (fundingRequirementSats as number) + changeDustFloor(address);
    assertDirtyCoinIsBestFit(pool, `${dirty.txid}:${dirty.vout}`, fundingRequirementSats as number, preferred);

    const page: Page = await browser.newPage();
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') {
        errors.push(m.text());
      }
    });

    // ─── connect watch-only ──────────────────────────────────────
    await page.goto(APP_URL);
    await expect(page.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="wallet-connect-btn"]').click();
    await expect(page.locator('[data-testid="wallet-picker-list"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="wallet-connect-xpub"]').click();
    await expect(page.locator('[data-testid="wallet-xpub-form"]')).toBeVisible();
    await page.locator('[data-testid="wallet-xpub-input"]').fill(accountTpub);
    // A bare tpub does not say which script type it is for, so the app asks
    // after the first attempt. Same two-step a reader walks.
    await page.locator('[data-testid="wallet-xpub-connect"]').click();
    const scriptType = page.locator('[data-testid="wallet-xpub-script-type"]');
    await scriptType.waitFor({ state: 'visible', timeout: 15_000 });
    await scriptType.selectOption('p2tr');
    await page.locator('[data-testid="wallet-xpub-connect"]').click();

    const xpubError = page.locator('[data-testid="wallet-xpub-error"]');
    await xpubError.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
    if (await xpubError.isVisible()) {
      throw new Error(`the app rejected the pasted xpub: ${(await xpubError.textContent())?.trim()}`);
    }
    await expect(page.locator('[data-testid="wallet-connected-address"]')).toBeVisible({ timeout: 30_000 });

    // ─── fill the form and mint ──────────────────────────────────
    await page.reload();
    await expect(page.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 15_000 });
    await openDetails(page, 'configurator-advanced');
    await fillCubeSides(page, CUBE_SIDE_IDS);

    await expect(page.locator('[data-testid="mint-cta"]')).toBeEnabled({ timeout: 60_000 });
    // `mint-btn` lives inside the drawer this click opens, so it IS an
    // appears-once effect and the guard fits. Left plain at first on the
    // reasoning that the next assertion might already be satisfied; it is
    // not, and CI failed here with "element(s) not found", the swallow
    // signature.
    await clickUntilEffect(
      page.locator('[data-testid="mint-cta"]'),
      page.locator('[data-testid="mint-btn"]'),
      { label: 'mint-cta -> mint-btn' },
    );

    const mintBtn = page.locator('[data-testid="mint-btn"]');
    await expect(mintBtn).toBeEnabled({ timeout: 60_000 });
    await mintBtn.click();

    const unsignedBox = page.locator('[data-testid="watch-only-unsigned-psbt"]');
    await expect(unsignedBox).toBeVisible({ timeout: 60_000 });
    const unsignedPsbt = (await unsignedBox.inputValue()).trim();

    const offline = btc.Transaction.fromPSBT(base64.decode(unsignedPsbt));
    offline.signIdx(leaf.privateKey!, 0);
    await page.locator('[data-testid="watch-only-signed-psbt"]').fill(base64.encode(offline.toPSBT()));
    await page.locator('[data-testid="watch-only-submit"]').click();

    const mintError = page.locator('[data-testid="mint-error-message"]');
    await mintError.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
    if (await mintError.isVisible()) {
      throw new Error(`the mint failed: ${(await mintError.textContent())?.trim()}`);
    }

    // The SAFE state, photographed once: a clean coin covers, so the guard
    // auto-picks it and says nothing at all. The quiet default is a state worth
    // documenting precisely because there is nothing to see.
    if (asset === 'cat') {
      await expect(page.locator('[data-testid="mint-asset-notice"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="mint-expert-required"]')).toHaveCount(0);
      fs.mkdirSync(STATE_SHOTS, { recursive: true });
      await page.locator('[data-testid="mint-checkout"]').screenshot({
        path: path.resolve(STATE_SHOTS, 'funding-safe-clean-coin.png'),
      });
    }

    await expect(page.locator('[data-testid="mint-success"]')).toBeVisible({ timeout: 120_000 });
    const commitTxId = (await page.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
    expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);

    // ─── the assertion: the dirty coin was not touched ───────────
    await waitForElectrsSync(mineBlocks(1));
    const commitTx = await waitForTxConfirmed(commitTxId);
    const spent = (commitTx.vin as { txid: string; vout: number }[])
      .map((v) => `${v.txid}:${v.vout}`);

    expect(
      spent,
      `the mint spent the coin carrying ${asset} (${dirty.assetId}). ` +
      `That coin was the smallest covering candidate, so an unguarded ` +
      `best-fit selection takes it and the asset is destroyed.`,
    ).not.toContain(dirty.outpoint);

    // The asset still sits where it was seeded, read back off the chain rather
    // than inferred from the input list.
    const stillThere = await waitForUtxoAt(address, DIRTY_SATS).catch(() => undefined);
    expect(stillThere, `the ${asset} coin no longer exists at ${address}`).toBeTruthy();

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
    await page.close();
  });
}
