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

  it('offers exactly the desktop inscription set, in matrix order', () => {
    // Positive-equality pin of the full ordered row set: membership + order in
    // one assertion. Phantom/Binance (mobile-only) being absent is a
    // consequence of this list, not a separate check.
    expect(rows().map((r) => r.wallet)).toEqual([
      KnownOrdinalWalletType.cat21wallet,
      KnownOrdinalWalletType.xverse,
      KnownOrdinalWalletType.leather,
      KnownOrdinalWalletType.unisat,
      KnownOrdinalWalletType.wizz,
      KnownOrdinalWalletType.okx,
      KnownOrdinalWalletType.alby,
      KnownOrdinalWalletType.xpub,
    ]);
  });

  it('excludes mobile-only wallets from the desktop set (Phantom, Binance)', () => {
    const types = rows().map((r) => r.wallet);
    expect(types).not.toContain(KnownOrdinalWalletType.phantom);
    expect(types).not.toContain(KnownOrdinalWalletType.binance);
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
});
