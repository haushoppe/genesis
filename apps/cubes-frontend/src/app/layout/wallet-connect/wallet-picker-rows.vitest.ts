import { describe, expect, it } from 'vitest';
import {
  KnownOrdinalWalletType, WalletCapability, WalletPlatform, walletPickerRows,
} from 'ordpool-sdk';

/**
 * Pins the connect-dialog rows cubes renders. The rows come straight from
 * the SDK's `walletPickerRows()` (the single source of truth for row shape
 * and button labels across the three sites), so these assert what a person
 * SEES: which wallets appear for the Inscription action on this device, in
 * matrix order, and the one button each row offers.
 *
 * Converted from the former `buildPickerRows` spec: that local mapping helper
 * was replaced by `walletPickerRows()` per the round-2 §7.2 decision. The
 * assertions that pinned the helper's internals have NO post-swap equivalent
 * because §7 removed that copy from the screen entirely, so they are dropped
 * rather than repointed:
 *   - the support-level wording ("Verified end-to-end on our test network");
 *   - the per-row signing-mode line ("You sign in your own wallet …").
 * Every other assertion (membership, matrix order, action tagging, button
 * label, download link, platform exclusion) survives and is pinned here.
 */
describe('walletPickerRows (Inscription, Desktop)', () => {
  // A fake window carrying only the provider globals detection reads; the
  // platform is passed explicitly so the set is deterministic regardless of
  // the test runner's navigator.
  const rows = (providers: Record<string, unknown> = {}) =>
    walletPickerRows({
      win: providers as unknown as Window,
      platform: WalletPlatform.Desktop,
      capability: WalletCapability.Inscription,
      currentUrl: 'https://cubes.haushoppe.art/',
    });

  it('tags an injected wallet (Leather) as connect with the Connect label', () => {
    const leather = rows({ LeatherProvider: {} }).find((r) => r.wallet === KnownOrdinalWalletType.leather);
    expect(leather?.action).toBe('connect');
    expect(leather?.actionLabel).toBe('Connect');
  });

  it('tags a not-injected wallet (Xverse) as install, carrying its download link', () => {
    const xverse = rows().find((r) => r.wallet === KnownOrdinalWalletType.xverse);
    expect(xverse?.action).toBe('install');
    expect(xverse?.actionLabel).toBe('Install');
    expect(xverse?.installUrl).toBe('https://www.xverse.app/download');
  });

  it('tags xpub as connect-xpub with no install link, regardless of detection', () => {
    const xpub = rows().find((r) => r.wallet === KnownOrdinalWalletType.xpub);
    expect(xpub?.action).toBe('connect-xpub');
    // Label is plain "Connect": the row's own name already says
    // Watch-only (xpub), so the button does not repeat it.
    expect(xpub?.actionLabel).toBe('Connect');
    expect(xpub?.installUrl).toBeUndefined();
  });

  it('offers every inscription-capable wallet, usable ones first', () => {
    // Positive-equality pin of the full ordered row set: membership AND order
    // in one assertion. The mobile-only wallets are at the end because the SDK
    // sorts by actionability, not because they are an afterthought.
    expect(rows().map((r) => r.wallet)).toEqual([
      KnownOrdinalWalletType.cat21wallet,
      KnownOrdinalWalletType.xverse,
      KnownOrdinalWalletType.leather,
      KnownOrdinalWalletType.unisat,
      KnownOrdinalWalletType.wizz,
      KnownOrdinalWalletType.okx,
      KnownOrdinalWalletType.alby,
      KnownOrdinalWalletType.xpub,
      KnownOrdinalWalletType.phantom,
      KnownOrdinalWalletType.binance,
    ]);
  });

  it('shows a wallet this device cannot use, rather than erasing it', () => {
    // The behaviour this replaced: mobile-only wallets were dropped from a
    // desktop list entirely. That told someone holding one that we do not
    // support it, while the same list advertised wallets they do not have. The
    // assertion is inverted on purpose; the old one pinned the erasure.
    const phantom = rows().find((r) => r.wallet === KnownOrdinalWalletType.phantom);
    expect(phantom).toBeDefined();
    expect(phantom?.reachableHere).toBe(false);
    expect(phantom?.action).toBe('use-on-mobile');
    expect(phantom?.actionLabel).toBe('Mobile only');
  });

  it('gives every unreachable row the SAME action, so one heading covers them', () => {
    // Load-bearing for the layout: the group carries one heading rather than a
    // per-row label. That is safe because the SDK derives the action from the
    // single opposite platform, so a mixed group cannot occur.
    const actions = new Set(rows().filter((r) => !r.reachableHere).map((r) => r.action));
    expect([...actions]).toEqual(['use-on-mobile']);
  });

  it('marks the wallets this device CAN use as reachable', () => {
    const reachable = rows().filter((r) => r.reachableHere).map((r) => r.wallet);
    expect(reachable).toContain(KnownOrdinalWalletType.leather);
    expect(reachable).toContain(KnownOrdinalWalletType.xpub);
    expect(reachable).not.toContain(KnownOrdinalWalletType.phantom);
  });

  it('renders every not-injected non-xpub wallet as an Install row with a real link', () => {
    // The empty state the maintainer's screenshot showed: no provider
    // injected. Every such row must be a real, actionable Install (never a
    // disabled-looking button), so it carries the "Install" label + a link.
    for (const r of rows()) {
      if (r.action === 'install') {
        expect(r.actionLabel).toBe('Install');
        expect(r.installUrl).toBeTruthy();
      }
    }
  });

  /**
   * The case the maintainer actually hit: a phone, with a wallet installed
   * that the picker had been erasing. Asserted here rather than in the browser
   * because the platform comes from the user agent, and a headless run cannot
   * be a phone without pretending to be one.
   */
  describe('on a phone', () => {
    const mobileRows = () =>
      walletPickerRows({
        win: {} as unknown as Window,
        platform: WalletPlatform.Mobile,
        capability: WalletCapability.Inscription,
        currentUrl: 'https://cubes.haushoppe.art/',
      });

    it('shows Leather instead of erasing it, marked as desktop-only', () => {
      const leather = mobileRows().find((r) => r.wallet === KnownOrdinalWalletType.leather);
      expect(leather).toBeDefined();
      expect(leather?.reachableHere).toBe(false);
      expect(leather?.action).toBe('use-on-desktop');
    });

    it('still offers the wallets a phone can actually use', () => {
      const usable = mobileRows().filter((r) => r.reachableHere).map((r) => r.wallet);
      expect(usable).toContain(KnownOrdinalWalletType.xverse);
      expect(usable).toContain(KnownOrdinalWalletType.xpub);
    });

    it('gives the unreachable group one action here too, so one heading covers it', () => {
      const actions = new Set(mobileRows().filter((r) => !r.reachableHere).map((r) => r.action));
      expect([...actions]).toEqual(['use-on-desktop']);
    });
  });
});
