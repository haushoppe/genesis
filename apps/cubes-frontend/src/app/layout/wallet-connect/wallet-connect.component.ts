import { ChangeDetectorRef, Component, DestroyRef, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgbModal, NgbModalRef, NgbPopover, NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';
import {
  KnownOrdinalWallets, KnownOrdinalWalletType, WalletCapability, WalletPlatform,
  WalletService, walletInAppBrowserDeepLink, walletsSupporting,
} from 'ordpool-sdk';
import { buildPickerRows } from './wallet-picker-rows';

/**
 * Where this browser can reach a wallet provider. Desktop is the
 * extension case; Mobile is a wallet's in-app dApp browser (Xverse /
 * OKX), which injects the same provider so the connect path is
 * identical. A mobile plain browser has no injected provider: its rows
 * fall through to the not-detected state.
 */
function detectPlatform(): WalletPlatform {
  if (typeof navigator === 'undefined') return WalletPlatform.Desktop;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
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

  /** Wallet types with a provider detected in this browser right now. */
  private readonly installedTypes = computed(
    () => new Set(this.wallets().installedWallets.map((w) => w.type)),
  );

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
    if (this.modalRef) return; // already open — remote-trigger no-op
    this.connectButtonDisabled.set(false);
    this.connectError.set(null);
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

  disconnect(popover: NgbPopover): void {
    popover.close();
    this.walletService.disconnectWallet();
  }

  copyToClipboard(text: string): void {
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).catch(() => {/* ignore */});
  }
}
