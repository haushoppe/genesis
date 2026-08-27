import { describe, expect, it } from 'vitest';
import {
  KnownOrdinalWallets, KnownOrdinalWalletType, WalletCapability, WalletPlatform, walletsSupporting,
} from 'ordpool-sdk/core';
import { buildPickerRows } from './wallet-picker-rows';

/**
 * Pins the matrix -> picker-row mapping. The wallet facts come from the
 * SDK matrix; these tests assert the cubes-side kind tagging and the
 * shared-spec wording, so a matrix change or a wording drift is caught.
 */
describe('buildPickerRows (Inscription, Desktop)', () => {
  const candidates = walletsSupporting(WalletCapability.Inscription, { platform: WalletPlatform.Desktop });
  const rows = (installed: KnownOrdinalWalletType[]) =>
    buildPickerRows(candidates, new Set(installed), WalletCapability.Inscription, KnownOrdinalWallets, () => null);

  it('tags an injected wallet with a detected provider as connect', () => {
    const leather = rows([KnownOrdinalWalletType.leather]).find((r) => r.type === KnownOrdinalWalletType.leather);
    expect(leather?.kind).toBe('connect');
  });

  it('tags an injected wallet without a provider as download, carrying its link', () => {
    const xverse = rows([]).find((r) => r.type === KnownOrdinalWalletType.xverse);
    expect(xverse?.kind).toBe('download');
    expect(xverse?.downloadLink).toBe('https://www.xverse.app/download');
  });

  it('tags xpub as watch-only-deferred with no download link, regardless of detection', () => {
    const xpub = rows([]).find((r) => r.type === KnownOrdinalWalletType.xpub);
    expect(xpub?.kind).toBe('watch-only-deferred');
    expect(xpub?.downloadLink).toBeUndefined();
    expect(xpub?.signingModeLine).toBe('You sign in your own wallet (Sparrow, Coldcard, Ledger, …)');
  });

  it('lists all seven capabilities per row', () => {
    const cat21 = rows([]).find((r) => r.type === KnownOrdinalWalletType.cat21wallet);
    expect(cat21?.allCapabilities.length).toBe(7);
  });

  it('renders the shared-spec wording: Alby inscribes (proven) but cannot create offers (unsupported + caveat)', () => {
    const alby = rows([]).find((r) => r.type === KnownOrdinalWalletType.alby);
    expect(alby?.actionCapability.icon).toBe('✓');
    expect(alby?.actionCapability.wording).toBe('Verified end-to-end on our test network');
    const offer = alby?.allCapabilities.find((c) => c.displayName === 'Sell (create an offer)');
    expect(offer?.icon).toBe('✕');
    expect(offer?.wording).toBe('Not available with this wallet');
    expect(offer?.caveat).toContain('cannot create offers');
  });

  it('tags a not-detected injected wallet with an available deep link as deep-link, others as download', () => {
    const deepLinked = buildPickerRows(
      candidates, new Set(), WalletCapability.Inscription, KnownOrdinalWallets,
      (w) => (w === KnownOrdinalWalletType.xverse ? 'https://connect.xverse.app/browser?url=x' : null),
    );
    const xverse = deepLinked.find((r) => r.type === KnownOrdinalWalletType.xverse);
    expect(xverse?.kind).toBe('deep-link');
    expect(xverse?.deepLink).toBe('https://connect.xverse.app/browser?url=x');
    const leather = deepLinked.find((r) => r.type === KnownOrdinalWalletType.leather);
    expect(leather?.kind).toBe('download');
  });

  it('offers exactly the desktop inscription set, in matrix order', () => {
    // Positive-equality pin of the full ordered row set. Locks both the
    // membership and the matrix order in one assertion; Phantom/Binance
    // (mobile-only) being absent is a consequence of this list, not a
    // separate negative check. If the SDK matrix reorders or adds/removes
    // a desktop inscription wallet, this is the test that catches it.
    expect(rows([]).map((r) => r.type)).toEqual([
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
    const types = rows([]).map((r) => r.type);
    expect(types).not.toContain(KnownOrdinalWalletType.phantom);
    expect(types).not.toContain(KnownOrdinalWalletType.binance);
  });
});
