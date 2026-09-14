import { HttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MintStatusService } from './mint-status.service';

/**
 * The polling LIFECYCLE, which the pure-function spec beside this one cannot
 * reach. Both defects pinned here were shipped and invisible: the suite was
 * green because it only ever asked `nextMintTxStatus` what a single response
 * means, never what the service does with two of them.
 */

const TXID = 'a'.repeat(64);

/** One controllable response per request, in call order. */
function httpStub() {
  const pending: Subject<unknown>[] = [];
  const urls: string[] = [];
  const http = {
    get: (url: string) => {
      urls.push(url);
      const s = new Subject<unknown>();
      pending.push(s);
      return s.asObservable();
    },
  };
  return { http, pending, urls };
}

function makeService(http: unknown): MintStatusService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: HttpClient, useValue: http },
      MintStatusService,
    ],
  });
  return TestBed.inject(MintStatusService);
}

describe('MintStatusService polling lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not let a slow response walk a confirmed mint back to mempool', () => {
    const { http, pending } = httpStub();
    const service = makeService(http);
    const status = service.statusOf(TXID);

    // Request A goes out on registration and is slow.
    expect(pending.length).toBe(1);
    const slow = pending[0];

    // The interval fires; the in-flight guard means no second request yet.
    vi.advanceTimersByTime(5_000);
    expect(pending.length).toBe(1);

    // A answers "confirmed".
    slow.next({ status: { confirmed: true, block_height: 840_123 } });
    expect(status()).toEqual({ state: 'confirmed', blockHeight: 840_123 });

    // A straggler from an earlier, slower path reports the tx as unconfirmed.
    // Applying it would lose the block height AND restart the loop, because the
    // loop's exit condition reads the very state it just regressed.
    slow.next({ status: { confirmed: false } });
    expect(status()).toEqual({ state: 'confirmed', blockHeight: 840_123 });
  });

  it('keeps one request per txid in flight', () => {
    const { http, pending } = httpStub();
    const service = makeService(http);
    service.statusOf(TXID);

    expect(pending.length).toBe(1);
    // Several ticks with the first request still out.
    vi.advanceTimersByTime(5_000);
    vi.advanceTimersByTime(5_000);
    vi.advanceTimersByTime(5_000);
    expect(pending.length).toBe(1);
  });

  it('backs off a reveal that never confirms instead of asking every five seconds forever', () => {
    const { http, pending } = httpStub();
    const service = makeService(http);
    service.statusOf(TXID);

    // Answer every request with "still in the mempool" for an hour of ticks.
    let answered = 0;
    for (let elapsed = 0; elapsed < 60 * 60_000; elapsed += 5_000) {
      while (answered < pending.length) {
        pending[answered].next({ status: { confirmed: false } });
        answered += 1;
      }
      vi.advanceTimersByTime(5_000);
    }

    // A flat five-second poll would be 720 requests in that hour. The backoff
    // has to be well under that; the exact figure is not the point, the order
    // of magnitude is.
    expect(pending.length).toBeLessThan(60);
    expect(pending.length).toBeGreaterThan(5);
  });

  it('stops polling once the tx is confirmed', () => {
    const { http, pending } = httpStub();
    const service = makeService(http);
    const status = service.statusOf(TXID);

    pending[0].next({ status: { confirmed: true, block_height: 1 } });
    expect(status().state).toBe('confirmed');

    const after = pending.length;
    vi.advanceTimersByTime(60_000);
    expect(pending.length).toBe(after);
  });

  it('hands the same signal back for a txid it already tracks, without a second request', () => {
    const { http, pending } = httpStub();
    const service = makeService(http);
    const first = service.statusOf(TXID);
    const second = service.statusOf(TXID.toUpperCase());
    expect(second).toBe(first);
    expect(pending.length).toBe(1);
  });
});
