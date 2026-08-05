import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { WalletService } from 'ordpool-sdk';
import { BehaviorSubject, Observable } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { CubesDataService } from './cubes-data/cubes-data.service';
import { InscriptionExtended } from './cubes-data/types';
import { PastMintsService } from './past-mints.service';

// Test doubles for the SDK's WalletService and CubesDataService.
// PastMintsService injects both to derive the myCubes signal — the
// tests replace them with tiny controllable stubs so no HttpClient
// or real wallet is required.

class WalletServiceStub {
  readonly connectedWallet$ = new BehaviorSubject<
    { ordinalsAddress: string; paymentAddress: string } | null
  >(null);
}

class CubesDataServiceStub {
  private readonly all$ = new BehaviorSubject<InscriptionExtended[]>([]);
  getAllCubes(): Observable<InscriptionExtended[]> {
    return this.all$.asObservable();
  }
  setCubes(cubes: InscriptionExtended[]): void {
    this.all$.next(cubes);
  }
}

interface Bed {
  svc: PastMintsService;
  wallet: WalletServiceStub;
  cubes: CubesDataServiceStub;
}

function freshBed(): Bed {
  TestBed.resetTestingModule();
  const wallet = new WalletServiceStub();
  const cubes = new CubesDataServiceStub();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: WalletService, useValue: wallet },
      { provide: CubesDataService, useValue: cubes },
    ],
  });
  const svc = TestBed.inject(PastMintsService);
  return { svc, wallet, cubes };
}

function makeCube(over: Partial<InscriptionExtended> & { txid: string; firstOwner: string | null }): InscriptionExtended {
  const { txid, firstOwner, ...rest } = over;
  return {
    inscriptionId: `${txid}i0`,
    inscriptionNumber: 1,
    blockHeight: 800_000,
    meta: { name: 'Ordinal Cube #1', attributes: [] },
    firstOwner,
    ...rest,
  };
}

describe('PastMintsService — recording + storage (parity with pre-refactor behaviour)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty when nothing in localStorage', () => {
    const { svc } = freshBed();
    expect(svc.pastMints()).toEqual([]);
  });

  it('records a mint at the head of the list', () => {
    const { svc } = freshBed();
    svc.record('commit-1', 'reveal-1');
    const list = svc.pastMints();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ commitTxId: 'commit-1', revealTxId: 'reveal-1', inscriptionIds: [] });
    expect(list[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('records the six inscription ids when provided', () => {
    const { svc } = freshBed();
    const ids = ['a'.repeat(64) + 'i0', 'b'.repeat(64) + 'i0'];
    svc.record('commit-1', 'reveal-1', ids);
    expect(svc.pastMints()[0].inscriptionIds).toEqual(ids);
  });

  it('records multiple mints newest-first', () => {
    const { svc } = freshBed();
    svc.record('c1', 'r1');
    svc.record('c2', 'r2');
    const list = svc.pastMints();
    expect(list.map((m) => m.revealTxId)).toEqual(['r2', 'r1']);
  });

  it('rehydrates from localStorage on construction', () => {
    localStorage.setItem(
      'cube_past',
      JSON.stringify([
        { commitTxId: 'c-old', revealTxId: 'r-old', createdAt: '2026-01-01T00:00:00Z' },
      ]),
    );
    const { svc } = freshBed();
    expect(svc.pastMints()).toHaveLength(1);
    expect(svc.pastMints()[0].revealTxId).toBe('r-old');
    expect(svc.pastMints()[0].inscriptionIds).toEqual([]);
  });

  it('tolerates corrupt localStorage payload', () => {
    localStorage.setItem('cube_past', 'not-json-{{');
    const { svc } = freshBed();
    expect(svc.pastMints()).toEqual([]);
  });

  it('tolerates non-array payload', () => {
    localStorage.setItem('cube_past', JSON.stringify({ some: 'object' }));
    const { svc } = freshBed();
    expect(svc.pastMints()).toEqual([]);
  });
});

describe('PastMintsService — myCubes derivation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is empty when no wallet is connected', async () => {
    const { svc, cubes } = freshBed();
    cubes.setCubes([
      makeCube({ txid: 'a'.repeat(64), firstOwner: 'bc1paddr' }),
    ]);
    TestBed.tick();
    expect(svc.myCubes()).toEqual([]);
  });

  it('includes cubes from the index that match the connected wallet ordinals address', async () => {
    const { svc, wallet, cubes } = freshBed();
    const addr = 'bc1pdemo';
    wallet.connectedWallet$.next({ ordinalsAddress: addr, paymentAddress: 'bc1qdemo' });
    cubes.setCubes([
      makeCube({ txid: 'a'.repeat(64), firstOwner: addr, inscriptionNumber: 42 }),
      makeCube({ txid: 'b'.repeat(64), firstOwner: 'bc1pother', inscriptionNumber: 43 }),
    ]);
    TestBed.tick();
    const list = svc.myCubes();
    expect(list).toHaveLength(1);
    expect(list[0].source).toBe('index');
    if (list[0].source === 'index') {
      expect(list[0].inscriptionNumber).toBe(42);
      expect(list[0].firstOwner).toBe(addr);
    }
  });

  it('is case-insensitive when matching wallet address', async () => {
    const { svc, wallet, cubes } = freshBed();
    wallet.connectedWallet$.next({ ordinalsAddress: 'BC1PMixedCase', paymentAddress: 'bc1qx' });
    cubes.setCubes([
      makeCube({ txid: 'a'.repeat(64), firstOwner: 'bc1pmixedcase' }),
    ]);
    TestBed.tick();
    expect(svc.myCubes()).toHaveLength(1);
  });

  it('includes localStorage entries whose revealTxid is NOT yet in the index', async () => {
    const { svc, wallet, cubes } = freshBed();
    wallet.connectedWallet$.next({ ordinalsAddress: 'bc1paddr', paymentAddress: 'bc1qaddr' });
    cubes.setCubes([]);
    svc.record('commit-pending', 'reveal-pending', []);
    TestBed.tick();
    const list = svc.myCubes();
    expect(list).toHaveLength(1);
    expect(list[0].source).toBe('local');
    expect(list[0].revealTxId).toBe('reveal-pending');
  });

  it('places local (pending) entries BEFORE indexed entries so just-minted cubes surface first', async () => {
    const { svc, wallet, cubes } = freshBed();
    const addr = 'bc1paddr';
    wallet.connectedWallet$.next({ ordinalsAddress: addr, paymentAddress: 'bc1qx' });
    cubes.setCubes([
      makeCube({ txid: 'a'.repeat(64), firstOwner: addr, inscriptionNumber: 1 }),
    ]);
    svc.record('c2', 'reveal-fresh', []);
    TestBed.tick();
    const list = svc.myCubes();
    expect(list.map((c) => c.source)).toEqual(['local', 'index']);
  });

  it('drops a localStorage entry once its revealTxid appears in the index (self-cleanup)', async () => {
    const { svc, wallet, cubes } = freshBed();
    const addr = 'bc1paddr';
    wallet.connectedWallet$.next({ ordinalsAddress: addr, paymentAddress: 'bc1qx' });
    const revealTxid = 'a'.repeat(64);
    svc.record('c-x', revealTxid, []);
    expect(svc.pastMints()).toHaveLength(1);
    cubes.setCubes([makeCube({ txid: revealTxid, firstOwner: addr })]);
    TestBed.tick();
    expect(svc.pastMints()).toHaveLength(0);
    const list = svc.myCubes();
    expect(list).toHaveLength(1);
    expect(list[0].source).toBe('index');
  });

  it('shows the cube exactly once even if it appears in both localStorage and the index', async () => {
    const { svc, wallet, cubes } = freshBed();
    const addr = 'bc1paddr';
    wallet.connectedWallet$.next({ ordinalsAddress: addr, paymentAddress: 'bc1qx' });
    const revealTxid = 'a'.repeat(64);
    svc.record('c-x', revealTxid, []);
    cubes.setCubes([makeCube({ txid: revealTxid, firstOwner: addr })]);
    TestBed.tick();
    expect(svc.myCubes()).toHaveLength(1);
  });

  it('is empty when wallet has no address (empty string treated as no wallet)', async () => {
    const { svc, wallet, cubes } = freshBed();
    wallet.connectedWallet$.next({ ordinalsAddress: '', paymentAddress: 'bc1qx' });
    cubes.setCubes([makeCube({ txid: 'a'.repeat(64), firstOwner: null })]);
    TestBed.tick();
    expect(svc.myCubes()).toEqual([]);
  });
});
