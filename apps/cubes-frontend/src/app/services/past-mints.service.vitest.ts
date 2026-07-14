import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { PastMintsService } from './past-mints.service';

function freshBed(): PastMintsService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection()],
  });
  return TestBed.inject(PastMintsService);
}

describe('PastMintsService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty when nothing in localStorage', () => {
    const svc = freshBed();
    expect(svc.pastMints()).toEqual([]);
  });

  it('records a mint at the head of the list', () => {
    const svc = freshBed();
    svc.record('commit-1', 'reveal-1');
    const list = svc.pastMints();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ commitTxId: 'commit-1', revealTxId: 'reveal-1' });
    expect(list[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('records multiple mints newest-first', () => {
    const svc = freshBed();
    svc.record('c1', 'r1');
    svc.record('c2', 'r2');
    const list = svc.pastMints();
    expect(list.map((m) => m.revealTxId)).toEqual(['r2', 'r1']);
  });

  it('rehydrates from localStorage on construction', async () => {
    localStorage.setItem(
      'cube_past',
      JSON.stringify([
        { commitTxId: 'c-old', revealTxId: 'r-old', createdAt: '2026-01-01T00:00:00Z' },
      ]),
    );
    const svc = freshBed();
    expect(svc.pastMints()).toHaveLength(1);
    expect(svc.pastMints()[0].revealTxId).toBe('r-old');
  });

  it('tolerates corrupt localStorage payload', () => {
    localStorage.setItem('cube_past', 'not-json-{{');
    const svc = freshBed();
    expect(svc.pastMints()).toEqual([]);
  });

  it('tolerates non-array payload', () => {
    localStorage.setItem('cube_past', JSON.stringify({ some: 'object' }));
    const svc = freshBed();
    expect(svc.pastMints()).toEqual([]);
  });
});
