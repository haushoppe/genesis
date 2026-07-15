import { ChangeDetectorRef, Component, DestroyRef, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgbModal, NgbModalRef, NgbPopover, NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';
import { KnownOrdinalWallets, KnownOrdinalWalletType, WalletService } from 'ordpool-sdk';

/**
 * Always-visible wallet-connect widget for the app-shell header.
 * Mirrors cat21-indexer's WalletConnect: NgbModal for the picker,
 * NgbPopover for the connected-state menu with addresses +
 * copy-to-clipboard + disconnect.
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
  private readonly walletsRaw = toSignal(this.walletService.wallets$, {
    initialValue: { installedWallets: [], notInstalledWallets: [] },
  });

  /** Drop wallets whose `onChainOrdinals` flag is explicitly false —
   *  a cube mint needs on-chain BTC. */
  protected readonly wallets = computed(() => {
    const raw = this.walletsRaw();
    return {
      installedWallets: raw.installedWallets.filter((w) => w.onChainOrdinals !== false),
      notInstalledWallets: raw.notInstalledWallets.filter((w) => w.onChainOrdinals !== false),
    };
  });

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
