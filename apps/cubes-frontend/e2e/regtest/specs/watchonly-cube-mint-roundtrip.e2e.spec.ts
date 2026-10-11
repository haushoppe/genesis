/**
 * @test-kind e2e
 * Real:   cubes app on the Angular dev server (ng serve -c regtest), regtest stack (bitcoind
 *         30, ordpool-electrs, cat21-ord, stock ord, ordpool-backend); no wallet extension, a
 *         per-run xpub account (makeWatchOnlyTestAccount, ordpool-sdk) signed offline
 * Faked:  nothing
 * Proves: the watch-only path (paste xpub, export the unsigned PSBT, paste it back signed)
 *         confirms a cube whose ord-indexed body equals getCubeHtml() for the typed sides,
 *         parses back to the typed side ids and the typed title, pays the tip once, and the
 *         mint preview paints dark
 */
import { test, expect, chromium, Browser, Page } from '@playwright/test';
import { randomBytes } from '@noble/hashes/utils';

import {
  fundCommonSats,
  getStockOrdContent,
  makeWatchOnlyTestAccount,
  mineBlocks,
  rpc,
  waitForElectrsSync,
  waitForOrdStockSync,
  waitForTxConfirmed,
  waitForUtxoAt,
  installContextErrorGuard,
  type WatchOnlyTestAccount,
  netLogArgs,
  offlineLaunchArgs,
  reachableHosts,
} from 'ordpool-sdk/e2e';
import {
  connectWatchOnly,
  CUBES_URL,
  expectMintSuccess,
  fillCubeSides,
  expectedRegtestCubeHtml,
  parseRegtestCube,
  openDetails,
  openMintCheckout,
  RENDERABLE_SIDE_IDS,
  expectTipPaid,
  openWalletPopover,
} from '../regtest-helpers';

/**
 * The SECOND way to mint a cube, proven end to end by clicking it.
 *
 * cubes has two mint paths, not one. Seven specs beside this one cover the
 * first: an injected browser wallet signs in its own popup. This covers the
 * other: a watch-only connection, where the reader pastes an account extended
 * public key, the app hands them an unsigned PSBT, they sign it in a wallet
 * this browser never sees (Sparrow, Electrum, Coldcard, a hardware device) and
 * paste the signed one back.
 *
 * It had no click-through coverage at all. `ordpool-sdk` proves the watch-only
 * pipeline three times over on its own regtest stack, which says the SDK works
 * and says nothing about whether this app wires it up: the xpub form, the
 * address the connect derives, the modal that carries the PSBT out and back,
 * and the submit that resumes the mint are all cubes' own code.
 *
 * What stands in for the offline wallet is deliberately NOT the app's code.
 * `makeWatchOnlyTestAccount` derives and signs through `@scure/bip32` and
 * `@scure/btc-signer` directly, not through the connector the app uses, so the
 * address this test funds is an independent answer to the same derivation
 * question the app answers, and step 3 asserts the two agree. If the
 * app ever derives a different address, the mint would silently be funded from
 * a coin the reader does not own, and that assertion is what catches it.
 *
 *   1. Derive a fresh taproot account offline; keep the private half.
 *   2. Fund its receive address (index 0) on regtest.
 *   3. Paste the account tpub into the connect modal; assert the app derives
 *      the same address the coin was sent to.
 *   4. Fill the six sides, open the drawer, click the confirm button.
 *   5. The watch-only modal carries the commit's unsigned PSBT out. Sign it
 *      offline, paste it back, submit.
 *   6. Read the commit and reveal txids off the success panel, mine both.
 *   7. Fetch the inscription from stock ord and byte-compare the content
 *      against the exact bytes the preview said it would inscribe.
 *
 * No browser extension is involved, which is the point: the signature comes
 * from outside the browser by construction.
 */

const CUBE_SIDE_IDS = RENDERABLE_SIDE_IDS;
/**
 * In BTC, because that is what `fundCommonSats` takes. Worth stating: the
 * parameter is a number either way, so passing sats compiles and funds the
 * address with two hundred thousand bitcoin, which regtest will cheerfully
 * refuse in a way that looks like a wallet bug.
 */
/**
 * The one field a person types that the chain stores back, so it carries every
 * shape that is known to survive a generator and still arrive wrong:
 *
 * - `$$` and `$&`, the SILENT substitution patterns of `String.replace`. They
 *   corrupt the title while leaving a structurally valid cube, so they reach
 *   the chain and are paid for.
 * - `&`, `<`, `>`, `"`, the four characters `escapeCubeTitle` encodes and
 *   `parseCube` decodes. Asymmetry between those two maps is invisible to any
 *   assertion that does not start from typed input.
 * - `&lt;` written out literally, which must come back as those four
 *   characters and not as `<`. It is the case that forces `&amp;` to decode
 *   last, and the one a sequential-replace implementation gets wrong.
 * - Non-ASCII (`café`, an emoji), which passes through unescaped and dies to
 *   byte-vs-character length handling rather than to escaping.
 *
 * `$'` is deliberately absent. It splices the rest of the template into the
 * title, which breaks `parseCube`, trips the Warning sentinel and refuses the
 * mint: unpleasant, but loud, and it would fail this spec at its own setup
 * rather than at the assertion that matters.
 *
 * This is the one thing the byte comparison below CANNOT catch on its own. It
 * compares the chain against `getCubeHtml`, which is the app's own generator,
 * so a bug inside that function corrupts both sides equally and they agree. A
 * dollar sign in a title did exactly that, and shipped: "Worth $$$" was
 * inscribed as "Worth $$". The guard that works is the round-trip below, which
 * compares the chain against what was TYPED into the form.
 */
const CUBE_TITLE = 'Worth $$$ & A $& B <b> "q" &lt; café 🧊';

const FUND_AMOUNT_BTC = 0.002;
const FUND_SATS = 200_000;

let browser: Browser;
let cubes: Page;

/** The offline wallet. Its private half never reaches the browser. */
let offline: WatchOnlyTestAccount;
let fundedAddress: string;

// Assigned when the page is created (below); the assertion is in the test
// body, a different scope from the setup that installs it.
let errorGuard: ReturnType<typeof installContextErrorGuard>;

/**
 * Mean luminance of a PNG screenshot, 0 (black) to 255 (white).
 *
 * Decoded without an image library: a Playwright screenshot is a PNG, and
 * sampling it needs pixels. `sharp` is not a dependency here and adding one to
 * read brightness would be the heavier answer, so the bytes are averaged
 * through the browser instead, which already has a decoder.
 */
async function meanLuminanceInPage(page: Page, pngBase64: string): Promise<number> {
  return page.evaluate(async (b64: string) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    return sum / (data.length / 4);
  }, pngBase64);
}



test.beforeAll(async () => {
  const tip = Number(rpc('getblockcount').trim());
  if (tip < 101) {
    throw new Error(`regtest tip is ${tip} (<101). Run: bash e2e/regtest/regtest-bootstrap.sh`);
  }

  // A fresh account every run: nothing is pinned to a committed key, and a
  // leftover UTXO from a previous run cannot make a broken derivation pass.
  offline = makeWatchOnlyTestAccount({ seed: randomBytes(32) });
  fundedAddress = offline.addressAt(0);

  // No wallet extension, so no launchWalletContext, but the same switches it
  // passes: nothing but loopback and the regtest stack resolves, and with
  // ORDPOOL_E2E_NET_LOG_DIR set the net log records what the browser sent.
  browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', ...offlineLaunchArgs(reachableHosts()), ...netLogArgs('watchonly')],
  });
  const context = await browser.newContext();
  // Fails the test on any console.error or uncaught exception from a page of this context.
  errorGuard = installContextErrorGuard(context);
  cubes = await context.newPage();
});

test.afterAll(async () => {
  await browser?.close();
});

test('watchonly: mint a cube by pasting an xpub → sign the PSBT offline → paste it back → ord indexes the HTML byte-for-byte', async () => {
  // ─── Step 1: fund the offline wallet's receive address ─────────
  // fundCommonSats, not a raw coinbase: a block's first sat reads as an
  // uncommon rare sat, which correctly forces expert mode and would take this
  // test somewhere it is not trying to go.
  await fundCommonSats(fundedAddress, FUND_AMOUNT_BTC);
  await waitForUtxoAt(fundedAddress, FUND_SATS);

  // ─── Step 2: connect watch-only, through the real form ─────────
  await cubes.goto(CUBES_URL);
  await expect(cubes.locator('[data-testid="page-title"]')).toBeVisible();

  await connectWatchOnly(cubes, offline.accountExtendedPublicKey);

  // ─── Step 3: the app's derivation must equal the offline one ───
  // The load-bearing assertion of this spec. If these disagree, the app is
  // watching an address the reader does not control.
  // The trigger carries a SHORTENED address, so the full one is read from the
  // popover it opens. Both addresses are asserted: a watch-only taproot account
  // is single-address by construction, and if the app ever derived a different
  // one for either role, a mint would be funded from, or land on, a coin the
  // reader does not control.
  await openWalletPopover(cubes);
  const paymentLocator = cubes.locator('[data-testid="wallet-popover-payment-address"]');
  const ordinalsLocator = cubes.locator('[data-testid="wallet-popover-ordinals-address"]');
  // The popover renders after the click, so read only once it is on screen.
  // Without the wait, textContent returns '' and the comparison fails on an
  // empty string, which reads like a derivation mismatch and is not one.
  await expect(paymentLocator).toBeVisible();
  await expect(ordinalsLocator).toBeVisible();
  // The VISIBLE text is elided in the middle for width ("bcrt1p…l6dj"), so the
  // comparison reads the title, which carries the address in full. Comparing
  // the elided form would pass on any address sharing six characters at each
  // end, which is exactly the kind of assertion that looks strict and is not.
  const paymentAddress = (await paymentLocator.getAttribute('title'))?.trim();
  const ordinalsAddress = (await ordinalsLocator.getAttribute('title'))?.trim();
  expect(paymentAddress).toBe(fundedAddress);
  expect(ordinalsAddress).toBe(fundedAddress);
  await cubes.keyboard.press('Escape');

  // ─── Step 4: fill the form and open the drawer ─────────────────
  await cubes.reload();
  await expect(cubes.locator('[data-testid="page-title"]')).toBeVisible();
  // Same helper the seven wallet specs use: a <details> is opened by setting
  // its `open` property, because clicking the summary is subject to the
  // element being scrolled into view and not covered, and this one sits below
  // a live preview whose height changes while the page settles.
  await openDetails(cubes, 'configurator-advanced');
  await fillCubeSides(cubes, CUBE_SIDE_IDS);
  await cubes.locator('[data-testid="cube-title"]').fill(CUBE_TITLE);

  await openMintCheckout(cubes);

  const mintBtn = cubes.locator('[data-testid="mint-btn"]');
  await expect(mintBtn).toBeEnabled();

  // The exact bytes this form will inscribe. `getCubeHtml` is the pure
  // function the component encodes as the inscription body, so this is an
  // independent statement of what the on-chain content must be, made before
  // anything is signed.
  const expectedCubeHtml = expectedRegtestCubeHtml({
    inscriptionIds: {
      inscriptionId1: CUBE_SIDE_IDS[0],
      inscriptionId2: CUBE_SIDE_IDS[1],
      inscriptionId3: CUBE_SIDE_IDS[2],
      inscriptionId4: CUBE_SIDE_IDS[3],
      inscriptionId5: CUBE_SIDE_IDS[4],
      inscriptionId6: CUBE_SIDE_IDS[5],
    },
    title: CUBE_TITLE,
    rotationSpeedX: '',
    rotationSpeedY: '',
    colorPane: '',
    bgColor1: '',
    bgColor2: '',
  });
  expect(expectedCubeHtml).toContain('cubes.haushoppe.art');

  await mintBtn.click();

  // ─── Step 5: the PSBT goes out, gets signed offline, comes back ─
  const unsignedBox = cubes.locator('[data-testid="watch-only-unsigned-psbt"]');
  await expect(unsignedBox).toBeVisible();
  const unsignedPsbt = (await unsignedBox.inputValue()).trim();
  expect(unsignedPsbt.length).toBeGreaterThan(0);

  // The offline wallet's half: parse, sign input 0 key-path, re-serialise.
  // None of it is the app's code, which is the whole point of the path.
  const signedPsbt = offline.signExportedPsbt(unsignedPsbt);
  expect(signedPsbt).not.toBe(unsignedPsbt);

  await cubes.locator('[data-testid="watch-only-signed-psbt"]').fill(signedPsbt);
  await cubes.locator('[data-testid="watch-only-submit"]').click();

  // ─── Step 6: the mint resumes and broadcasts ───────────────────
  await expectMintSuccess(cubes);
  const commitTxId = (await cubes.locator('[data-testid="mint-commit-txid"]').textContent())?.trim() ?? '';
  const revealTxId = (await cubes.locator('[data-testid="mint-reveal-txid"]').getAttribute('aria-label'))?.trim() ?? '';
  expect(commitTxId).toMatch(/^[0-9a-f]{64}$/);
  expect(revealTxId).toMatch(/^[0-9a-f]{64}$/);

  // ─── Step 6b: the success preview actually paints ──────────────
  //
  // What is and is not provable here, stated plainly so nobody reads more
  // into a green than it carries.
  //
  // PROVEN: the iframe's document loads and paints its dark stage. That is
  // the srcdoc mechanism this app calls load-bearing (see CLAUDE.md, "Cube
  // iframes"), and the regression it guards against was a white flash, so
  // the measurement is the same one that rule demands: sample the rendered
  // pixels rather than trust an attribute.
  //
  // NOT PROVABLE ON REGTEST: a painted CUBE. The renderer is itself a
  // MAINNET inscription, loaded through the document's base href, which on
  // this chain resolves to the regtest content host and 404s. So no spec
  // here can assert that a cube appears, and one claiming to would be
  // asserting the stage and calling it the cube.
  const preview = cubes.locator('[data-testid="mint-success-preview"]');
  // Waits for the cube document's BASE, not for the dark meta: the placeholder
  // document carries that same meta by design, and the cube document then
  // replaces the iframe element, so a wait on the meta is met by a placeholder
  // that is about to be swapped out and the box read below finds nothing.
  // The iframe loads its bytes on intersection, so the success panel around it
  // is scrolled in first. The panel, not the iframe: the iframe element is
  // replaced when the cube document arrives, and a scroll that resolved the
  // old element fails on a detached node.
  await cubes.locator('[data-testid="mint-success"]').scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('srcdoc', /<base href="http:\/\/[^"]+:8999\/">/);
  await expect(preview).toHaveAttribute('srcdoc', /<meta name="color-scheme" content="dark">/);
  await expect(preview).toBeVisible();

  const box = await preview.boundingBox();
  expect(box, 'the preview must have a rendered box, not zero height').toBeTruthy();
  const shot = await preview.screenshot();
  const luminance = await meanLuminanceInPage(cubes, shot.toString('base64'));
  // A blank or white frame reads near 255; the dark stage sits far below it.
  // The window this catches is real: the frame was white for seconds before
  // the srcdoc mechanism existed.
  expect(luminance, `preview mean luminance was ${luminance}`).toBeLessThan(120);
  expect(luminance, 'a fully black box would mean nothing painted at all').toBeGreaterThan(0);

  // ─── Step 7: both confirm, ord indexes, bytes match ────────────
  await waitForElectrsSync(mineBlocks(1));
  const commitTx = await waitForTxConfirmed(commitTxId);
  await waitForElectrsSync(mineBlocks(1));
  const revealTx = await waitForTxConfirmed(revealTxId);
  expect(revealTx.status.block_hash).toBeTruthy();

  expectTipPaid(commitTx, revealTx);

  await waitForOrdStockSync(Number(rpc('getblockcount').trim()));
  const { bytes, contentType } = await getStockOrdContent(`${revealTxId}i0`);
  expect(contentType).toBe('text/html;charset=utf-8');

  const onChainHtml = new TextDecoder().decode(bytes);
  expect(onChainHtml).toBe(expectedCubeHtml);

  // The parser the gallery uses must read the on-chain bytes back as the same
  // six sides the form was filled with.
  const parsed = parseRegtestCube(onChainHtml);
  expect(parsed).toBeTruthy();
  const parsedSides = parsed!
    .filter((t) => /^Side \d$/.test(t.trait_type))
    .sort((a, b) => a.trait_type.localeCompare(b.trait_type))
    .map((t) => t.value);
  expect(parsedSides).toEqual(CUBE_SIDE_IDS);

  // The independent half. Everything above compares the chain against the
  // app's own generator, so a bug inside it agrees with itself. This compares
  // the chain against the string a person typed, decoded by a different
  // function, and it is the assertion that a dollar sign in a title would have
  // failed before today's fix.
  const parsedTitle = parsed!.find((t) => t.trait_type === 'Title')?.value;
  expect(parsedTitle).toBe(CUBE_TITLE);

  errorGuard.assertClean();
});
