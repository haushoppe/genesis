// Imported from the main entry, not `ordpool-sdk/core`: the genesis CI
// installs with `npm ci --ignore-scripts`, so the SDK's prepare step never
// builds `dist-core/` (what `/core` maps to, and which is not checked in).
// The main entry's `dist/` is checked in and always resolves without a build
// step. These matrix symbols are pure data either way.
import {
  CapabilitySupport,
  KnownOrdinalWallet,
  KnownOrdinalWallets,
  KnownOrdinalWalletType,
  WalletCapability,
  WalletCapabilityStatus,
  WalletMatrixEntry,
  WalletPlatform,
  capabilityOf,
} from 'ordpool-sdk';

/**
 * Presentation model that turns SDK capability-matrix rows into the
 * cubes wallet-picker view-model.
 *
 * The WALLET FACTS (support level, caveat, note, platforms) come from
 * the SDK matrix and are never hardcoded here. Only the USER-FACING
 * WORDING lives here, and it is dictated by the binding shared spec
 * `wallet-picker-ux-shared.md` (the support-level table and the
 * capability display names). Those strings must stay identical across
 * cat21.space, ordpool.space, and cubes; keep this file in step with
 * that doc, not with local taste.
 */

/** Display names for each capability, per wallet-picker-ux-shared.md. */
const CAPABILITY_DISPLAY_NAMES: Record<WalletCapability, string> = {
  [WalletCapability.Cat21Mint]: 'Mint a cat',
  [WalletCapability.Cat21Transfer]: 'Send a cat',
  [WalletCapability.Cat21OfferCreate]: 'Sell (create an offer)',
  [WalletCapability.Cat21OfferAccept]: 'Buy (accept an offer)',
  [WalletCapability.Inscription]: 'Inscribe',
  [WalletCapability.InscriptionParentChild]: 'Collections (parent/child)',
  [WalletCapability.SignMessage]: 'Sign a message',
};

/** One capability line in the info popover. */
export interface CapabilityLine {
  displayName: string;
  /** ✓ proven, ○ adapter, ✕ unsupported. */
  icon: string;
  /** Support-level wording from the shared spec's table. */
  wording: string;
  /** The matrix caveat sentence, shown after the wording when present. */
  caveat?: string;
}

/**
 * A picker row action:
 * - `connect`: injected wallet with a provider detected right now.
 * - `deep-link`: injected wallet not present here, but reachable via its
 *   mobile in-app browser (a docs-verified deep link exists). "Open in X".
 * - `download`: injected wallet with no provider and no deep link (get it).
 * - `watch-only`: signs out-of-page (Sparrow / Electrum / Coldcard / Ledger
 *   / …). The row opens a paste-xpub connect; each inscribe then exports a
 *   PSBT the user signs in their own wallet and pastes back.
 */
export type WalletRowKind = 'connect' | 'deep-link' | 'download' | 'watch-only';

export interface WalletRowVM {
  type: KnownOrdinalWalletType;
  label: string;
  logo: string;
  subLabel?: string;
  kind: WalletRowKind;
  /** Present only for `download` rows. */
  downloadLink?: string;
  /** Present only for `deep-link` rows: the wallet's in-app browser URL. */
  deepLink?: string;
  /** Platform badges, e.g. ['Desktop', 'Mobile']. */
  platforms: string[];
  /** "Signs in your browser" / "You sign in your own wallet …". */
  signingModeLine: string;
  /** The current page action (Inscribe) status for this wallet. cubes is a
   *  single-action site, so the popover shows only this, not the full
   *  capability list (X-3: single-action → action capability). */
  actionCapability: CapabilityLine;
  /** Wallet-level note, shown as the popover footer. */
  note?: string;
}

/** Maps a matrix support status to the shared spec's wording + icon. */
function supportWording(status: WalletCapabilityStatus): { icon: string; wording: string; caveat?: string } {
  switch (status.support) {
    case CapabilitySupport.Proven:
      // Proven, plus the caveat sentence when the matrix carries one.
      return { icon: '✓', wording: 'Verified end-to-end on our test network', caveat: status.caveat };
    case CapabilitySupport.Adapter:
      // Forward the caveat too: no Adapter row carries one today, but the
      // matrix is the source of truth, so a future one must not be dropped.
      return { icon: '○', wording: 'Supported, not yet verified end-to-end', caveat: status.caveat };
    case CapabilitySupport.Unsupported:
      return { icon: '✕', wording: 'Not available with this wallet', caveat: status.caveat };
  }
}

function capabilityLine(wallet: KnownOrdinalWalletType, capability: WalletCapability): CapabilityLine {
  const w = supportWording(capabilityOf(wallet, capability));
  return { displayName: CAPABILITY_DISPLAY_NAMES[capability], icon: w.icon, wording: w.wording, caveat: w.caveat };
}

function platformLabel(platform: WalletPlatform): string {
  return platform === WalletPlatform.Desktop ? 'Desktop' : 'Mobile';
}

function signingModeLine(mode: WalletMatrixEntry['signingMode']): string {
  // The watch-only wallet list comes from the SDK matrix (F2: single source
  // of truth, `KnownOrdinalWallets[xpub].subLabel`), never a hardcoded string,
  // so it cannot drift from the sister sites.
  return mode === 'watch-only'
    ? `You sign in your own wallet (${KnownOrdinalWallets[KnownOrdinalWalletType.xpub].subLabel})`
    : 'Signs in your browser';
}

/**
 * Build the ordered picker rows for one page action.
 *
 * @param candidates matrix entries from `walletsSupporting(action, {platform})`.
 * @param installedTypes wallet types with a provider detected at runtime.
 * @param action the capability the current page performs (Inscription on cubes).
 * @param meta `KnownOrdinalWallets`: logos, download links, sub-labels.
 * @param deepLinkFor resolves a wallet's in-app-browser deep link, or null
 *   (the SDK verifies only some; only used for a not-detected injected wallet).
 */
export function buildPickerRows(
  candidates: readonly WalletMatrixEntry[],
  installedTypes: ReadonlySet<KnownOrdinalWalletType>,
  action: WalletCapability,
  meta: Record<KnownOrdinalWalletType, KnownOrdinalWallet>,
  deepLinkFor: (wallet: KnownOrdinalWalletType) => string | null,
): WalletRowVM[] {
  return candidates.map((entry) => {
    const m = meta[entry.wallet];
    const detected = installedTypes.has(entry.wallet);
    const deepLink = entry.signingMode === 'watch-only' || detected ? null : deepLinkFor(entry.wallet);
    const kind: WalletRowKind =
      entry.signingMode === 'watch-only' ? 'watch-only'
        : detected ? 'connect'
          : deepLink ? 'deep-link'
            : 'download';
    return {
      type: entry.wallet,
      label: entry.label,
      logo: m.logo,
      subLabel: m.subLabel,
      kind,
      downloadLink: m.downloadLink || undefined,
      deepLink: deepLink || undefined,
      platforms: entry.platforms.map(platformLabel),
      signingModeLine: signingModeLine(entry.signingMode),
      actionCapability: capabilityLine(entry.wallet, action),
      note: entry.note,
    };
  });
}
