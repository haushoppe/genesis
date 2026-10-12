// Cubes-specific helpers for the regtest e2e specs: the mint form's controls,
// the cube body's renderer-id bridge, and the tip assertion. Generic chain,
// electrs and ord helpers (rpc, mineBlocks, fundCommonSats, waitForElectrsSync,
// getUtxos, getStockOrdContent, ...) come from
// `ordpool-sdk/e2e`, which reads the REGTEST_* container and wallet names that
// playwright.config.ts sets for this stack.

import { expect, type Page } from '@playwright/test';
import { clickUntilEffect, raceApprovalPopup, regtestServiceUrls, stackPort, type ApprovalPopupSearch, type EsploraTx } from 'ordpool-sdk/e2e';

import { regtestInscriptions } from '../../src/environments/regtest-inscriptions.generated';
import { getCubeHtml } from '../../src/app/services/cube-html';
import { parseCube } from '../../src/shared/ordinals/parse-cube';

/**
 * The regtest dev server the specs drive, on the slot's app port, where the
 * runner config starts it.
 */
export const CUBES_URL = `${regtestServiceUrls().app}/`;

// App-specific: the base href cubes' srcdoc preview carries for its own preview host.
/**
 * The `<base>` a mint-success preview document carries: the root of the
 * ordpool backend behind `ownPreviewIframe`, on the slot's port, so a relative
 * `/content/<id>` in the cube body resolves against this stack's backend.
 */
export const OWN_PREVIEW_BASE_HREF = new RegExp(`<base href="http://[^"]+:${stackPort('ordpoolBackend')}/">`);

/** When `configurator-advanced` was last opened, per page, for `fillCubeSides`. */
const detailsOpenedAt = new WeakMap<Page, number>();

// App-specific: opens the mint form's `<details>` disclosures by their cubes testids.
/**
 * Force-open a `<details>` element identified by its `data-testid`.
 * The mint UI hides fee-rate + UTXO controls and the six-side inputs
 * behind collapsed `<details>` for normal users; specs that drive
 * those controls must open the disclosure first, otherwise
 * `.fill()` throws on inputs whose ancestor `display: none` makes
 * them non-actionable.
 */
export async function openDetails(page: Page, testId: string): Promise<void> {
  await page.locator(`[data-testid="${testId}"]`).evaluate(
    (el: HTMLDetailsElement) => { el.open = true; },
  );
  if (testId === 'configurator-advanced') detailsOpenedAt.set(page, Date.now());
}

// App-specific: the cube side fixtures inscribed by e2e/regtest/inscribe-fixtures.sh.
/**
 * The six image sides and the non-image side the specs fill, read from the ids
 * e2e/regtest/inscribe-fixtures.sh inscribed on THIS chain from the committed
 * fixtures. They are byte-identical to their mainnet originals, so the mint
 * form's black-face probe, the cube body and the preview all resolve against
 * the regtest stack and nothing reaches mainnet.
 */
export const RENDERABLE_SIDE_IDS = regtestInscriptions.fallbackSides;

/** A regtest inscription whose body is JSON: loads with 200, never decodes as an image. */
export const NON_IMAGE_SIDE_ID = regtestInscriptions.nonImageSide;


/**
 * The cube mint pays a fixed tip to an address the minter does not control.
 * Nothing else in the suite looks at it, so a build that dropped the tip, paid
 * the wrong address or paid the wrong amount would still produce a valid cube,
 * still index byte-for-byte, and still pass every wallet lane.
 *
 * Asserted per wallet rather than once, because the app only BUILDS the
 * transaction: the wallet signs it, and a wallet that rewrites outputs is not
 * hypothetical here. Xverse's Accelerate feature rewrote an unconfirmed CAT-21
 * mint and dropped its nLockTime=21, which is the same failure shape applied to
 * a different field.
 *
 * The two values are literals owned by the test, never imported from
 * `environment.regtest.ts`. Importing them would compare the app's output
 * against the app's own input, so changing the tip would move both sides
 * together and leave this green. They live here rather than in eight specs so
 * that one edit updates them, which is safe precisely because this file is not
 * the code under test.
 */
const TIP_ADDRESS = 'bcrt1pgnmqsy3m04999vwvczfuuualuptlcwnlqx7yrf7y2xwzyswdxpvq92zqwq';
const TIP_SATS = 1000;

// App-specific: the cube mint's tip output.
/**
 * Assert the tip was paid exactly once across the commit and reveal pair.
 * Spans both because either may legitimately carry it; requiring EXACTLY one
 * match means a tip paid twice fails as loudly as a tip not paid at all.
 */
export function expectTipPaid(commitTx: EsploraTx, revealTx: EsploraTx): void {
  const toTip = [...commitTx.vout, ...revealTx.vout]
    .filter((o) => o.scriptpubkey_address === TIP_ADDRESS);

  // Exactly ONE output reaches the tip address, and it is the tip. The second
  // half pins the ABSENCE of a fixture collision, which is the thing that
  // cannot be seen by looking: the tip address used to be the Leather test
  // wallet's own ordinals address, so the cube's 546-sat postage landed here
  // too and a tip wrongly paid to the connected wallet read as correct. The
  // address above is derived from a passphrase no wallet seed reaches, and
  // this assertion fails the moment someone reintroduces a convenient one.
  expect(
    toTip.map((o) => o.value),
    `expected exactly one ${TIP_SATS}-sat tip to ${TIP_ADDRESS} and nothing else. ` +
    `More than one output here means the tip address collides with an address ` +
    `the wallet itself owns, which blinds this assertion.`,
  ).toEqual([TIP_SATS]);
}

// App-specific: the cubes header's connected-wallet popover.
/**
 * Open the connected-wallet popover and return once its contents are on screen.
 *
 * The trigger is a toggle, and the wallet row re-renders as the wallet's state
 * settles after a connect or a reload. A click that lands on the node being
 * replaced is swallowed: the popover never opens, and the spec fails on the
 * address element rather than on the click, which reads like a missing element
 * instead of a lost click. `clickUntilEffect` re-clicks only while the toggle
 * never flipped: ngbPopover sets `aria-describedby` on its trigger while the
 * popover is open, so a trigger without it is still in its pre-click state,
 * and a second click can never close what the first one opened.
 */
export async function openWalletPopover(page: Page): Promise<void> {
  const trigger = page.getByTestId('wallet-connected-btn');
  const content = page.getByTestId('wallet-popover-payment-address');
  await expect(trigger).toBeVisible();
  // Already open: a click would close it.
  if (await content.isVisible()) return;
  const { clicks } = await clickUntilEffect(trigger, content, {
    label: 'wallet-connected-btn -> wallet popover',
    stillPreClick: async () => (await trigger.getAttribute('aria-describedby')) === null,
  });
  if (clicks > 1) console.log(`[openWalletPopover] opened only after ${clicks} clicks`);
}

// App-specific: reads the cubes header's connected-wallet popover.
/**
 * Read an address out of the connected-wallet popover. The VISIBLE text is
 * elided in the middle, so the address comes from `title`.
 */
export async function readWalletPopoverAddress(
  page: Page,
  testId: 'wallet-popover-payment-address' | 'wallet-popover-ordinals-address',
): Promise<string> {
  await openWalletPopover(page);
  const field = page.getByTestId(testId);
  await expect(field).toHaveAttribute('title', /\S/);
  return ((await field.getAttribute('title')) ?? '').trim();
}

// App-specific: the cubes mint CTA and its checkout drawer.
/**
 * Click the top-level mint CTA until the checkout drawer is actually open.
 *
 * The CTA's own disabled state depends on a probe that resolves asynchronously,
 * so the button can be re-rendered around the moment it is clicked and the
 * click is swallowed. `clickUntilEffect` re-clicks only while the CTA is still
 * visible and enabled with no drawer, the swallowed-click signature, and the
 * click count is reported: more than one names a defect to chase, not a
 * harness detail.
 */
export async function openMintCheckout(page: Page): Promise<void> {
  const cta = page.getByTestId('mint-cta');
  await expect(cta).toBeEnabled();
  const { clicks } = await clickUntilEffect(cta, page.getByTestId('mint-checkout'), {
    label: 'mint-cta -> mint-checkout',
  });
  if (clicks > 1) console.log(`[openMintCheckout] drawer opened only after ${clicks} clicks`);
}

// App-specific: the cubes watch-only (xpub) connect form.
/**
 * Connect a watch-only account through the header's xpub form, as a taproot
 * account, and return once the header shows it connected.
 *
 * The first connect click reveals the script-type picker, the second connects.
 * A rejected xpub shows `wallet-xpub-error` and never connects, so both waits
 * race the error against the state they expect: the error is reported with its
 * text instead of the picker or the connected address simply never appearing.
 */
export async function connectWatchOnly(page: Page, accountTpub: string): Promise<void> {
  await page.getByTestId('wallet-connect-btn').click();
  await expect(page.getByTestId('wallet-picker-list')).toBeVisible();
  await page.getByTestId('wallet-connect-xpub').click();
  await expect(page.getByTestId('wallet-xpub-form')).toBeVisible();
  await page.getByTestId('wallet-xpub-input').fill(accountTpub);

  // A bare tpub does not say which script type it is for, so the app asks, and
  // it asks only AFTER a connect attempt: the ambiguity is reported by the SDK,
  // not guessed from the prefix. This is the real two-step the reader walks.
  // The ambiguity shows the picker together with a message asking for the
  // type; a key the app rejects shows the message alone. So the wait is on
  // either, and a message without a picker is the rejection, reported here.
  const xpubError = page.getByTestId('wallet-xpub-error');
  const scriptType = page.getByTestId('wallet-xpub-script-type');
  await page.getByTestId('wallet-xpub-connect').click();
  await expect(scriptType.or(xpubError).first()).toBeVisible();
  if (!(await scriptType.isVisible())) {
    throw new Error(`the app rejected the pasted xpub: ${(await xpubError.textContent())?.trim()}`);
  }
  await scriptType.selectOption('p2tr');
  // Confirm the selection STUCK. A selection that silently does not take
  // derives a different script type, and the failure then surfaces much
  // later as an address with no funds rather than as a wrong choice here.
  await expect(scriptType).toHaveValue('p2tr');
  await page.getByTestId('wallet-xpub-connect').click();

  const connected = page.getByTestId('wallet-connected-address');
  await expect(xpubError.or(connected).first()).toBeVisible();
  if (await xpubError.isVisible()) {
    throw new Error(`the app rejected the pasted xpub: ${(await xpubError.textContent())?.trim()}`);
  }
}

// App-specific: the cubes mint result panel.
/**
 * Wait for the mint to finish, and fail with the app's own message when it
 * reports an error instead.
 *
 * Success and failure are two exclusive states of the same panel, so the wait
 * is on either of them: a mint that fails is reported with its error text at
 * once, rather than as a success that never arrived.
 */
export async function expectMintSuccess(page: Page): Promise<void> {
  const success = page.getByTestId('mint-success');
  const error = page.getByTestId('mint-error-message');
  await expect(success.or(error).first()).toBeVisible();
  if (await error.isVisible()) {
    throw new Error(`the mint reported an error: ${(await error.textContent())?.trim()}`);
  }
  await expect(page.getByTestId('mint-btn')).toHaveAttribute('aria-busy', 'false');
}

// App-specific: the cubes mint error message raced against a wallet's sign popup.
/**
 * After the Mint click, wait for the wallet's sign popup, or fail with the
 * app's message when the mint errors before asking the wallet.
 *
 * `mint-error-message` exists only on the path where no popup is coming, so it
 * is the state `raceApprovalPopup` needs: a simulation or PSBT build that
 * throws is reported with its text, instead of as a popup that never opened.
 */
export async function signPopupOrMintError(
  page: Page,
  search: ApprovalPopupSearch,
): Promise<Page> {
  const error = page.getByTestId('mint-error-message');
  const race = await raceApprovalPopup({ ...search, noPopupState: error });
  if (race.outcome === 'no-popup') {
    throw new Error(`the mint reported an error before the sign popup opened: ${(await error.textContent())?.trim()}`);
  }
  return race.page;
}

// App-specific: the six cube-side inputs of the mint form.
/**
 * Fill the side inputs, confirm each value STUCK, and characterise whatever
 * clobbered one if something did.
 *
 * The BASELINE, measured in CI (`genesis` a6141d6, 23 occurrences across one
 * green matrix run): the suggestion routinely lands on the still-blank form
 * BEFORE the loop types anything, so at "after side 1" sides 2 to 6 already
 * hold suggestion ids and side 1 holds ours. That is the guard working as
 * designed, it happens constantly, and it must stay silent.
 *
 * The DEFECT has the opposite shape: a side the loop has ALREADY typed comes
 * back holding something else. Twice in CI that was side 1, with sides 2 to 5
 * the spec's own, which against the baseline above reads as the fill of side 1
 * never taking rather than as a writer picking one field out of six. A fill
 * that lands while the control re-renders under it does not stick, and the
 * suggestion's whole-form write IS a re-render of all six fields.
 *
 * So the gate is "an already-typed side deviates", never "anything deviates".
 * When it trips, the untyped sides decide the one thing they can: whether the
 * suggestion's write was CONCURRENT. Holding ids means it landed in this
 * window and the lost fill needs no further explanation; blank means it did
 * not, and something else re-rendered or wrote. They do not establish that a
 * writer of some shape exists, because a lost fill has no writer at all.
 * The reading only exists during the first pass, so it is scoped to it: once
 * the loop has refilled sides 2 to 6 the two cases are indistinguishable,
 * which is exactly the misreading the CI artifacts invited.
 *
 * It is not the suggestion effect reading a lagging form signal.
 * `@angular/forms/signals` writes the model inside the `input` event
 * (`nativeControlCreate` -> `parser.setRawValue` -> `controlValue.set` ->
 * `debounceSync()`, whose only `await` sits behind `if (debouncer)`, and no
 * field or ancestor here declares one), so it reaches `sync()` synchronously
 * and no effect can interleave.
 */
export async function fillCubeSides(page: Page, ids: readonly string[]): Promise<void> {
  const readAll = () =>
    Promise.all(ids.map((_, i) =>
      page.locator(`[data-testid="cube-side-${i + 1}"]`).inputValue()));

  /**
   * Report only if a side at or before `typedUpTo` lost its typed value; the
   * untyped sides are context for the verdict, never a reason to speak.
   * `typedUpTo` of -1 means the whole set has been typed.
   */
  const reportClobber = async (values: string[], typedUpTo: number, when: string): Promise<boolean> => {
    const last = typedUpTo < 0 ? ids.length - 1 : typedUpTo;
    const clobbered = values
      .map((v, i) => ({ i, v }))
      .filter(({ i, v }) => i <= last && v !== ids[i]);
    if (clobbered.length === 0) return false;

    for (const { i, v } of clobbered) {
      console.log(`[fillCubeSides] ${when}: side ${i + 1} holds "${v}", typed "${ids[i]}"`);
    }
    for (const { i } of clobbered) {
      const same = await sameNode(i);
      console.log(`[fillCubeSides] ${when}: side ${i + 1} is ` + (
        same === null ? 'of unknown node identity'
          : same ? 'the SAME DOM node, so a write or a clobber, not a rebuild'
            : 'a DIFFERENT DOM node, so the element was REPLACED and no write ever happened'));
    }
    if (typedUpTo >= 0) {
      const untyped = ids.length - 1 - last;
      const untypedFilled = values.filter((v, i) => i > last && v !== '').length;
      // What the untyped sides can decide is whether the SUGGESTION's
      // whole-form write was concurrent with the lost fill, not that some
      // writer of a given shape exists. A fill can simply fail to take when
      // the control re-renders under it, and then there is no writer at all.
      console.log(
        `[fillCubeSides] ${when}: ${clobbered.length} typed side(s) lost their value, ` +
        `${untypedFilled} of ${untyped} not-yet-typed side(s) hold ids -> ` +
        (untypedFilled > 0
          ? 'the suggestion\'s whole-form write landed in this window, so the lost fill is consistent with a re-render of all six'
          : 'NO suggestion write in this window, so something else re-rendered or wrote'));
    }
    return true;
  };

  // Characterise the first clobber once: the signal is the moment it happens,
  // and repeating it for every later side buries it.
  let characterised = false;

  // The six input NODES as they are before any typing. If a value vanishes
  // because its element was replaced, no write ever happened and no write
  // inventory could have found it. Template reading says these views are
  // never recreated (`@for` over a module constant, no conditional ancestor),
  // but template reading is what nearly produced the opposite conclusion, so
  // this answers it empirically instead.
  const nodesBefore = await Promise.all(ids.map((_, i) =>
    page.locator(`[data-testid="cube-side-${i + 1}"]`).elementHandle()));

  /** Is side `i` still the same DOM node it was before the loop started? */
  const sameNode = async (i: number): Promise<boolean | null> => {
    const before = nodesBefore[i];
    if (!before) return null;
    return page.locator(`[data-testid="cube-side-${i + 1}"]`)
      .evaluate((el, prev) => el === prev, before);
  };

  const openedAt = detailsOpenedAt.get(page);
  let gapToFirstFill: number | null = null;


  for (let attempt = 0; attempt < 3; attempt++) {
    for (let i = 0; i < ids.length; i++) {
      if ((await readAll())[i] !== ids[i]) {
        await page.locator(`[data-testid="cube-side-${i + 1}"]`).fill(ids[i]);
      }
      // Every verified loss so far has been side 1 and only side 1, three for
      // three, which is not the shape of a writer landing at a random moment.
      // Whatever it is happens once and is over before side 2. So record how
      // long after the panel opened the first fill completed, and print it on
      // losing AND surviving passes: if losses cluster at short gaps, the
      // window is the first moments after opening and can be placed instead of
      // waited for.
      if (attempt === 0 && i === 0 && openedAt !== undefined) {
        gapToFirstFill = Date.now() - openedAt;
      }
      if (attempt === 0 && !characterised) {
        characterised = await reportClobber(await readAll(), i, `after side ${i + 1}`);
      }
    }
    const lostThisPass = await reportClobber(await readAll(), -1, `attempt ${attempt + 1}`);
    if (attempt === 0 && gapToFirstFill !== null) {
      console.log(`[fillCubeSides] open->side1 gap ${gapToFirstFill}ms, ` +
        (lostThisPass ? 'a side was LOST' : 'all sides held'));
    }
    if (!lostThisPass) {
      if (attempt > 0) console.log(`[fillCubeSides] sides settled on attempt ${attempt + 1}`);
      return;
    }
  }
  throw new Error(`side inputs did not hold the typed ids after 3 attempts: ${JSON.stringify(await readAll())}`);
}

// App-specific: bridges the app's mainnet renderer id to the regtest one.
/**
 * The bytes a cube minted ON REGTEST will carry.
 *
 * `getCubeHtml` is the app's own generator and reads the cube renderer id from
 * `environments/environment`. Angular's `fileReplacements` swap that file for
 * `environment.regtest.ts` when it BUILDS the app, but a Playwright spec
 * imports the module directly in Node, where no replacement happens, so the
 * generator returns the MAINNET renderer id while the running app mints the
 * regtest one. A byte-for-byte assertion then fails on the one field that is
 * legitimately different, which is what it did:
 *
 *   Expected: src=/content/fed0eb2d...   (mainnet, what Node resolved)
 *   Received: src=/content/6e7cd90e...   (regtest, what the app minted)
 *
 * So the expectation is moved onto the regtest renderer, never the
 * observation. Throws if the mainnet id is absent, because that means the
 * substitution stopped applying and a silent pass-through would compare the
 * chain against the wrong bytes.
 */
const MAINNET_CUBE_RENDERER_ID = 'fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0';

export function expectedRegtestCubeHtml(cubeDetails: Parameters<typeof getCubeHtml>[0]): string {
  const html = getCubeHtml(cubeDetails);
  if (!html.includes(MAINNET_CUBE_RENDERER_ID)) {
    throw new Error(
      'getCubeHtml no longer emits the mainnet renderer id, so this substitution is stale. '
      + 'Check environments/environment.ts and this helper before trusting any byte comparison.',
    );
  }
  return html.replace(MAINNET_CUBE_RENDERER_ID, regtestInscriptions.cubeRenderer);
}

// App-specific: runs the app's cube parser on a regtest cube.
/**
 * Parse an on-chain regtest cube with the app's own parser.
 *
 * `parseCube` identifies a cube by its renderer id against a known-versions
 * list whose v3 entry is `environment.cubeRendererInscriptionId`. As with
 * `expectedRegtestCubeHtml` above, a Playwright spec imports it in Node where
 * Angular's `fileReplacements` do not apply, so the list holds the MAINNET id
 * while the bytes on chain carry the regtest one and the parser returns null.
 *
 * The regtest renderer is a byte-identical copy of the mainnet v3 (see
 * `e2e/regtest/fixtures/README.md`), so the cube genuinely IS a v3 and naming
 * it as one is not a fiction. Throws rather than returning a misleading null
 * if the input carries neither id.
 */
export function parseRegtestCube(onChainHtml: string): ReturnType<typeof parseCube> {
  if (onChainHtml.includes(MAINNET_CUBE_RENDERER_ID)) return parseCube(onChainHtml);
  if (!onChainHtml.includes(regtestInscriptions.cubeRenderer)) {
    throw new Error('cube html carries neither the mainnet nor the regtest renderer id');
  }
  return parseCube(onChainHtml.replace(regtestInscriptions.cubeRenderer, MAINNET_CUBE_RENDERER_ID));
}
