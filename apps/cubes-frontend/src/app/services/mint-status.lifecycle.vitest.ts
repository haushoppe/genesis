import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MintStatusService } from './mint-status.service';

/**
 * The polling LIFECYCLE, which the pure-function spec beside this one cannot
 * reach: it only ever asks `nextMintTxStatus` what a SINGLE response means,
 * never what the service does with a sequence of them over time.
 *
 * Nothing is mocked except the network itself. The real `HttpClient` runs with
 * Angular's testing BACKEND under it, so the URL the service assembles, the
 * request it issues and the way it consumes the response are all production
 * code paths. Replacing `HttpClient` wholesale would leave the `esploraBase`
 * assembly and the observable handling untested, and those are a real part of
 * what this service does.
 *
 * The clock is controlled rather than waited on, because the behaviour under
 * test IS timing.
 *
 * Note on `match`: it CONSUMES the requests it returns, so each call means
 * "the requests issued since I last looked", and calling it twice in a row
 * legitimately returns nothing the second time.
 */

const TXID = 'a'.repeat(64);

function makeService(): { service: MintStatusService; http: HttpTestingController } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      MintStatusService,
    ],
  });
  return {
    service: TestBed.inject(MintStatusService),
    http: TestBed.inject(HttpTestingController),
  };
}

/** Requests for this txid issued since the last call. Consuming, see above. */
function takeRequests(http: HttpTestingController, txid = TXID) {
  return http.match((req) => req.url.endsWith(`/tx/${txid}`));
}

describe('MintStatusService polling lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('asks esplora for the reveal txid, at the URL it assembles itself', () => {
    const { service, http } = makeService();
    service.statusOf(TXID);
    const req = http.expectOne((r) => r.url.endsWith(`/api/tx/${TXID}`));
    expect(req.request.method).toBe('GET');
  });

  it('keeps exactly one request per txid in flight', () => {
    // This is what makes an out-of-order pair impossible in the first place.
    // Before it, the interval fired a second request while the first was still
    // out, and whichever answered LAST won regardless of which was newer.
    const { service, http } = makeService();
    service.statusOf(TXID);

    vi.advanceTimersByTime(5_000);
    vi.advanceTimersByTime(5_000);
    vi.advanceTimersByTime(5_000);

    expect(takeRequests(http).length).toBe(1);
  });

  it('backs off a reveal that never confirms instead of asking every five seconds forever', () => {
    const { service, http } = makeService();
    service.statusOf(TXID);

    let issued = 0;
    for (let elapsed = 0; elapsed < 60 * 60_000; elapsed += 5_000) {
      for (const req of takeRequests(http)) {
        issued += 1;
        req.flush({ status: { confirmed: false } });
      }
      vi.advanceTimersByTime(5_000);
    }

    // A flat five-second poll would be 720 requests in that hour. The exact
    // figure is not the point; the order of magnitude is.
    expect(issued).toBeLessThan(60);
    expect(issued).toBeGreaterThan(5);
  });

  it('advances to confirmed and keeps the block height', () => {
    const { service, http } = makeService();
    const status = service.statusOf(TXID);
    takeRequests(http)[0].flush({ status: { confirmed: true, block_height: 840_123 } });
    expect(status()).toEqual({ state: 'confirmed', blockHeight: 840_123 });
  });

  it('stops polling once the tx is confirmed', () => {
    const { service, http } = makeService();
    const status = service.statusOf(TXID);

    takeRequests(http)[0].flush({ status: { confirmed: true, block_height: 1 } });
    expect(status().state).toBe('confirmed');

    vi.advanceTimersByTime(60_000);
    expect(takeRequests(http).length).toBe(0);
  });

  it('treats a 404 as "nothing to apply" rather than as a state', () => {
    const { service, http } = makeService();
    const status = service.statusOf(TXID);
    takeRequests(http)[0].flush('not found', { status: 404, statusText: 'Not Found' });
    expect(status()).toEqual({ state: 'unknown' });
  });

  it('hands the same signal back for a txid it already tracks, without a second request', () => {
    const { service, http } = makeService();
    const first = service.statusOf(TXID);
    const second = service.statusOf(TXID.toUpperCase());
    expect(second).toBe(first);
    expect(takeRequests(http).length).toBe(1);
  });
});
