import { ChangeDetectorRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { cat21Config, KnownOrdinalWalletType, WalletPlatform, WalletService } from 'ordpool-sdk';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { detectPlatform, WalletConnectComponent } from './wallet-connect.component';

/**
 * Exercises the real component logic without rendering its template:
 * the component class is constructed through DI (TestBed.inject) with a
 * mocked WalletService, so `connectXpub()` runs against a spy. Pins the
 * args handed to WalletService.connectXpub and the script-type-ambiguous
 * retry, per wallet-picker-watch-only-shared.md.
 */
describe('WalletConnectComponent: watch-only connect', () => {
  let connectXpub: ReturnType<typeof vi.fn>;
  let component: WalletConnectComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    connectXpub = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: WalletService,
          useValue: {
            connectedWallet$: new BehaviorSubject<unknown>(null),
            wallets$: new BehaviorSubject({ installedWallets: [], notInstalledWallets: [] }),
            networkMismatch$: new BehaviorSubject(false),
            expectedNetworkGroup: 'mainnet',
            walletConnectRequested$: new Subject<void>(),
            getInstalledWallets: () => ({ installedWallets: [], notInstalledWallets: [] }),
            connectXpub,
          },
        },
        { provide: NgbModal, useValue: {} },
        { provide: ChangeDetectorRef, useValue: { markForCheck: () => {} } },
        { provide: cat21Config, useValue: { ordApiUrl: 'https://ord.example.test', cat21OrdApiUrl: 'https://cat21.example.test' } },
      ],
    });
    // Construct the class in an injection context (so `inject()` /
    // `toSignal` / `effect` resolve) WITHOUT the injector instantiating a
    // component; the latter would demand a resolved template, which this
    // template-compiler-free vitest setup does not provide.
    component = TestBed.runInInjectionContext(() => new WalletConnectComponent());
  });

  it('connects directly when the key prefix implies the script type', () => {
    component.setXpubInput('  zpubEXAMPLE  ');
    connectXpub.mockReturnValueOnce(of({
      type: KnownOrdinalWalletType.xpub, ordinalsAddress: 'a', paymentAddress: 'b',
    }));

    component.connectXpub();

    expect(connectXpub).toHaveBeenCalledWith({
      extendedPublicKey: 'zpubEXAMPLE',
      scriptType: undefined,
      probe: expect.any(Function),
    });
    expect((component as unknown as { xpubNeedsScriptType(): boolean }).xpubNeedsScriptType()).toBe(false);
    expect((component as unknown as { xpubConnecting(): boolean }).xpubConnecting()).toBe(false);
  });

  it('reveals the account-type picker on an ambiguous key, then retries with the chosen scriptType', () => {
    component.setXpubInput('xpubEXAMPLE');

    connectXpub.mockReturnValueOnce(throwError(() => Object.assign(
      new Error('Watch-only: this key prefix (xpub/tpub) is script-type-ambiguous; pass scriptType'),
      // The SDK throws WatchOnlyDeriveError carrying a stable `code`; the
      // component branches on it, not on the (free-to-change) message.
      { code: 'script-type-ambiguous' },
    )));
    component.connectXpub();

    expect(connectXpub).toHaveBeenNthCalledWith(1, {
      extendedPublicKey: 'xpubEXAMPLE',
      scriptType: undefined,
      probe: expect.any(Function),
    });
    expect((component as unknown as { xpubNeedsScriptType(): boolean }).xpubNeedsScriptType()).toBe(true);
    expect((component as unknown as { xpubError(): string | null }).xpubError()).toContain('account type');

    component.setXpubScriptType('p2tr');
    connectXpub.mockReturnValueOnce(of({
      type: KnownOrdinalWalletType.xpub, ordinalsAddress: 'a', paymentAddress: 'b',
    }));
    component.connectXpub();

    expect(connectXpub).toHaveBeenNthCalledWith(2, {
      extendedPublicKey: 'xpubEXAMPLE',
      scriptType: 'p2tr',
      probe: expect.any(Function),
    });
  });

  it('re-evaluates a freshly pasted key: editing after an ambiguous xpub clears the script-type latch', () => {
    component.setXpubInput('xpubEXAMPLE');
    connectXpub.mockReturnValueOnce(throwError(() => Object.assign(
      new Error('Watch-only: this key prefix (xpub/tpub) is script-type-ambiguous; pass scriptType'),
      // The SDK throws WatchOnlyDeriveError carrying a stable `code`; the
      // component branches on it, not on the (free-to-change) message.
      { code: 'script-type-ambiguous' },
    )));
    component.connectXpub();
    expect((component as unknown as { xpubNeedsScriptType(): boolean }).xpubNeedsScriptType()).toBe(true);

    // Paste a SLIP-132 key next: the latch must reset so no scriptType is forced.
    component.setXpubInput('zpubEXAMPLE');
    expect((component as unknown as { xpubNeedsScriptType(): boolean }).xpubNeedsScriptType()).toBe(false);

    connectXpub.mockReturnValueOnce(of({
      type: KnownOrdinalWalletType.xpub, ordinalsAddress: 'a', paymentAddress: 'b',
    }));
    component.connectXpub();
    expect(connectXpub).toHaveBeenLastCalledWith(expect.objectContaining({ scriptType: undefined }));
  });

  it('guards an empty key: shows the paste hint and makes no wallet call', () => {
    component.setXpubInput('   ');
    component.connectXpub();
    expect((component as unknown as { xpubError(): string | null }).xpubError())
      .toBe('Paste your account extended public key (xpub / ypub / zpub / tpub) first.');

    // A subsequent valid attempt is the FIRST real call; the guarded one
    // never reached the wallet (positive-equality on the call count).
    component.setXpubInput('zpubEXAMPLE');
    connectXpub.mockReturnValueOnce(of({
      type: KnownOrdinalWalletType.xpub, ordinalsAddress: 'a', paymentAddress: 'b',
    }));
    component.connectXpub();
    expect(connectXpub).toHaveBeenCalledTimes(1);
    expect(connectXpub).toHaveBeenNthCalledWith(1, expect.objectContaining({ extendedPublicKey: 'zpubEXAMPLE' }));
  });
});

/**
 * detectPlatform() picks the wallet set (Desktop extensions vs Mobile in-app
 * deep-links). iPadOS Safari sends a desktop "Macintosh" UA, so the
 * maxTouchPoints tiebreak is what keeps iPads on the Mobile set.
 */
describe('detectPlatform', () => {
  const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/604.1';
  const original = { ua: navigator.userAgent, touch: navigator.maxTouchPoints };

  function setNavigator(userAgent: string, maxTouchPoints: number): void {
    Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
  }

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: original.ua, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: original.touch, configurable: true });
  });

  it('classifies an iPad (Macintosh UA + touch points) as Mobile', () => {
    setNavigator(MAC_UA, 5);
    expect(detectPlatform()).toBe(WalletPlatform.Mobile);
  });

  it('classifies a real Mac (Macintosh UA, no touch) as Desktop', () => {
    setNavigator(MAC_UA, 0);
    expect(detectPlatform()).toBe(WalletPlatform.Desktop);
  });

  it('classifies an iPhone as Mobile via the UA token', () => {
    setNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1', 5);
    expect(detectPlatform()).toBe(WalletPlatform.Mobile);
  });

  it('classifies desktop Chrome on Windows as Desktop', () => {
    setNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 0);
    expect(detectPlatform()).toBe(WalletPlatform.Desktop);
  });
});
