import { ChangeDetectorRef, Component, DestroyRef, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgbModal, NgbModalRef, NgbPopover, NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';
// All from the main entry, not `ordpool-sdk/core`: the genesis CI installs
// with `npm ci --ignore-scripts`, so the SDK's prepare step never builds
// `dist-core/` (what `/core` maps to, and which is not checked in). The main
// entry's `dist/` (Angular fesm) is checked in and always resolves without a
// build step, and it also carries WalletService (the Angular @Injectable).
import {
  cat21Config, KnownOrdinalWallets, KnownOrdinalWalletType, makeWatchOnlyProbe,
  WalletCapability, WalletPlatform, WalletService, WatchOnlyScriptType,
  walletInAppBrowserDeepLink, walletsSupporting,
} from 'ordpool-sdk';

import { environment } from '../../../environments/environment';
import { buildPickerRows } from './wallet-picker-rows';

/**
 * Where this browser can reach a wallet provider. Desktop is the
 * extension case; Mobile is a wallet's in-app dApp browser (Xverse /
 * OKX), which injects the same provider so the connect path is
 * identical. A mobile plain browser has no injected provider: its rows
 * fall through to the not-detected state.
 */
export function detectPlatform(): WalletPlatform {
  if (typeof navigator === 'undefined') return WalletPlatform.Desktop;
  const ua = navigator.userAgent;
  // iPadOS 13+ Safari reports a desktop "Macintosh" UA with no iPad/Mobile
  // token. A real Mac reports maxTouchPoints 0; an iPad reports > 1. That
  // pair is the documented way to tell an iPad from a Mac, so an iPad still
  // gets the Mobile wallet set (in-app-browser deep links) instead of the
  // desktop extension set with no reachable connect path.
  const isIpadOs = /Macintosh/i.test(ua)
    && typeof navigator.maxTouchPoints === 'number'
    && navigator.maxTouchPoints > 1;
  return isIpadOs || /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    ? WalletPlatform.Mobile
    : WalletPlatform.Desktop;
}

/**
 * Always-visible wallet-connect widget for the app-shell header.
 * NgbModal for the picker, NgbPopover for the connected-state menu.
 *
 * The picker is driven by the SDK capability matrix: it offers exactly
 * the wallets that can inscribe on the current platform
 * (`walletsSupporting(Inscription, {platform})`), cross-referenced with
 * runtime provider detection to mark each Connect vs Get-extension.
 * Every row carries an info popover sourced from the matrix, per the
 * binding wallet-picker-ux-shared.md spec.
 *
 * Extra vs cat21-indexer: subscribes to `walletConnectRequested$` so
 * any consumer (e.g. the Mint CTA in start.component) can trigger the
 * picker from a distance via `walletService.requestWalletConnect()`.
 */
@Component({
  selector: 'app-wallet-connect',
  templateUrl: './wallet-connect.component.html',
  styleUrls: ['./wallet-connect.component.scss'],
  imports: [NgbPopoverModule],
})
export class WalletConnectComponent {
  private readonly walletService = inject(WalletService);
  private readonly sdkConfig = inject(cat21Config);
  private readonly modalService = inject(NgbModal);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly connectedWallet = toSignal(this.walletService.connectedWallet$, { initialValue: null });
  protected readonly wallets = toSignal(this.walletService.wallets$, {
    initialValue: { installedWallets: [], notInstalledWallets: [] },
  });

  /** Which platform's wallet set to offer. Fixed per session (the UA
   *  doesn't change), so a plain field is enough. */
  protected readonly platform = detectPlatform();

  /** Wallet types with a provider detected in this browser right now.
   *  X-1: read the UNFILTERED getInstalledWallets(), not wallets$, which
   *  strips hiddenFromPicker on every platform: a detected Phantom/Binance
   *  in a mobile in-app browser must show Connect, not Get-wallet. wallets$
   *  stays only the re-emit trigger; the matrix `platforms` governs rows. */
  private readonly installedTypes = computed(() => {
    this.wallets(); // re-emit trigger: recompute when runtime detection changes
    return new Set(this.walletService.getInstalledWallets().installedWallets.map((w) => w.type));
  });

  /**
   * A wallet's in-app-browser deep link for the current page, or null.
   * Only on mobile: on desktop the in-app browser is not the reachable
   * surface, so a not-detected wallet is a Get-wallet, never an Open-in.
   */
  private readonly deepLinkFor = (wallet: KnownOrdinalWalletType): string | null =>
    this.platform === WalletPlatform.Mobile && typeof window !== 'undefined'
      ? walletInAppBrowserDeepLink(wallet, window.location.href)
      : null;

  /**
   * The picker rows: inscription-capable wallets for this platform, in
   * matrix order, each tagged Connect / Open-in / Get-wallet / Watch-only
   * and carrying its info-popover data.
   */
  protected readonly rows = computed(() =>
    buildPickerRows(
      walletsSupporting(WalletCapability.Inscription, { platform: this.platform }),
      this.installedTypes(),
      WalletCapability.Inscription,
      KnownOrdinalWallets,
      this.deepLinkFor,
    ),
  );

  /** True when no offered wallet has a provider detected. Drives the
   *  "no wallet detected" hint under the list. */
  protected readonly noneInstalled = computed(
    () => !this.rows().some((r) => r.kind === 'connect'),
  );

  /** True when the connected wallet's address prefix doesn't match
   *  the configured network (mainnet/regtest/testnet). Drives the
   *  red banner in the popover. */
  protected readonly networkMismatch = toSignal(this.walletService.networkMismatch$, { initialValue: false });
  protected readonly expectedNetworkGroup = this.walletService.expectedNetworkGroup;

  protected readonly knownOrdinalWallets = KnownOrdinalWallets;
  protected readonly connectButtonDisabled = signal(false);
  protected readonly connectError = signal<string | null>(null);

  // --- Watch-only (xpub) paste-connect state ------------------------------
  /** True while the paste-xpub form is expanded inside the connect modal. */
  protected readonly xpubOpen = signal(false);
  /** The pasted account extended public key. */
  protected readonly xpubInput = signal('');
  /** True once the SDK reports the key is script-type-ambiguous (plain
   *  xpub/tpub), which is when the account-type <select> is shown. */
  protected readonly xpubNeedsScriptType = signal(false);
  protected readonly xpubScriptType = signal<WatchOnlyScriptType>('p2tr');
  protected readonly xpubError = signal<string | null>(null);
  protected readonly xpubConnecting = signal(false);

  private readonly connectTemplate = viewChild.required<TemplateRef<unknown>>('connectModal');
  private modalRef: NgbModalRef | undefined;

  constructor() {
    // Remote trigger: consumers call walletService.requestWalletConnect()
    // to open the picker from anywhere in the app (e.g. Mint CTA).
    this.walletService.walletConnectRequested$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.open());

    // Close the modal as soon as a wallet lands. Belt-and-suspenders
    // beyond the closeModal() in the connect handler, in case the
    // connect flow resolves out-of-band.
    effect(() => {
      if (this.connectedWallet()) this.closeModal();
    });
  }

  /** First 6 + last 4 chars for the compact address label. */
  protected shortAddress(addr: string | undefined | null): string {
    if (!addr) return '';
    return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
  }

  open(): void {
    if (this.modalRef) return; // already open: remote-trigger no-op
    this.connectButtonDisabled.set(false);
    this.connectError.set(null);
    this.xpubOpen.set(false);
    this.modalRef = this.modalService.open(this.connectTemplate(), {
      ariaLabelledBy: 'wallet-connect-title',
      centered: true,
    });
    this.modalRef.result.finally(() => { this.modalRef = undefined; });
  }

  closeModal(): void {
    this.modalRef?.close();
    this.modalRef = undefined;
    this.connectButtonDisabled.set(false);
  }

  connectWallet(type: KnownOrdinalWalletType): void {
    // Unisat / most wallets: disable while a connect is in flight so
    // the user can't spam the extension's single popup.
    if (type !== KnownOrdinalWalletType.leather) {
      this.connectButtonDisabled.set(true);
    }
    this.connectError.set(null);
    this.walletService.connectWallet(type)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.closeModal();
          // Zoneless safety: the wallet's connect resolution often
          // fires outside any tracked context (extension postMessage
          // → tap() → connectedWallet$.next). Nudge CD so the header
          // button repaints immediately.
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.connectError.set(err instanceof Error ? err.message : String(err));
          this.connectButtonDisabled.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  /** Expand the paste-xpub form (from the watch-only row's Connect button). */
  openXpubForm(): void {
    this.xpubOpen.set(true);
    this.xpubInput.set('');
    this.xpubNeedsScriptType.set(false);
    this.xpubScriptType.set('p2tr');
    this.xpubError.set(null);
    this.xpubConnecting.set(false);
  }

  cancelXpubForm(): void {
    this.xpubOpen.set(false);
    this.xpubError.set(null);
  }

  setXpubInput(value: string): void {
    this.xpubInput.set(value);
    // A fresh key is re-evaluated from scratch: a SLIP-132 prefix (ypub /
    // zpub) implies its type, so clear the ambiguity latch and any prior
    // error instead of forwarding a scriptType chosen for a previous key.
    this.xpubNeedsScriptType.set(false);
    this.xpubError.set(null);
  }

  setXpubScriptType(value: string): void {
    this.xpubScriptType.set(value as WatchOnlyScriptType);
  }

  /**
   * Connect a watch-only wallet from the pasted account extended public key.
   * Composes the SDK's `connectXpub` (derive + scan + auto-pick) with an
   * electrs probe wired to this app's mempool API. On the SDK's
   * `script-type-ambiguous` error (a plain xpub/tpub), reveal the
   * account-type picker and let the user retry, mirroring the cat21 sites.
   */
  connectXpub(): void {
    const extendedPublicKey = this.xpubInput().trim();
    if (!extendedPublicKey) {
      this.xpubError.set('Paste your account extended public key (xpub / ypub / zpub / tpub) first.');
      return;
    }
    this.xpubError.set(null);
    this.xpubConnecting.set(true);
    // Only forward scriptType once the SDK has told us the key is
    // ambiguous: a SLIP-132 prefix (ypub/zpub/…) implies the type, and
    // passing a conflicting one throws.
    const scriptType = this.xpubNeedsScriptType() ? this.xpubScriptType() : undefined;
    this.walletService.connectXpub({
      extendedPublicKey,
      scriptType,
      probe: makeWatchOnlyProbe({
        // esplora lives behind the `/api` prefix on our backend (electrs);
        // makeWatchOnlyProbe hits `${esploraApiUrl}/address/:a/utxo`.
        esploraApiUrl: `${environment.mempoolApiUrl}/api`,
        ordApiUrl: this.sdkConfig.ordApiUrl,             // full ord: inscriptions, runes, rare sats
        cat21OrdApiUrl: this.sdkConfig.cat21OrdApiUrl,   // cat21-ord: cats
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.xpubConnecting.set(false);
          // connectedWallet$ fires → the constructor effect closes the modal.
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.xpubConnecting.set(false);
          // Branch on the SDK's stable WatchOnlyDeriveError.code, not the
          // human-readable message (free to change). `code` is a plain string
          // field, cross-realm safe, so no instanceof is needed.
          const code = (err as { code?: string } | null)?.code;
          const msg = err instanceof Error ? err.message : String(err);
          if (code === 'script-type-ambiguous') {
            this.xpubNeedsScriptType.set(true);
            this.xpubError.set('This looks like a plain xpub/tpub. Pick the account type (Taproot is recommended for ordinals), then connect again.');
          } else {
            this.xpubError.set(msg);
          }
          this.cdr.markForCheck();
        },
      });
  }

  disconnect(popover: NgbPopover): void {
    popover.close();
    this.walletService.disconnectWallet();
  }

  copyToClipboard(text: string): void {
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).catch(() => {/* ignore */});
  }
}
