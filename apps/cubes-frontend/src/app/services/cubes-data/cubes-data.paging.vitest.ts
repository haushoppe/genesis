import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { CubesDataService } from './cubes-data.service';

/**
 * Paging and the rarity fallback, against the real service over Angular's
 * testing HTTP backend. Only the network is stood in for: the ordering, the
 * slicing and the fallback are the production code paths.
 */

/** One cube row in the shape the public index serves. */
function cube(n: number) {
  return {
    inscriptionId: `${n.toString(16).padStart(64, '0')}i0`,
    inscriptionNumber: n,
    blockHeight: 800_000 + n,
    title: `Cube ${n}`,
    sides: [],
  };
}

function setup(count: number) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
  });
  return {
    service: TestBed.inject(CubesDataService),
    http: TestBed.inject(HttpTestingController),
    cubes: Array.from({ length: count }, (_, i) => cube(i + 1)),
  };
}

/** Answer the two fetches the list makes: the cubes, and the rarity index. */
function answer(http: HttpTestingController, cubes: unknown[], rarity: 'ok' | 'down') {
  http.match((r) => r.url.includes('cubes.json'))[0]?.flush(cubes);
  const rarityReq = http.match((r) => r.url.includes('rarity.json'))[0];
  if (rarity === 'ok') rarityReq?.flush({ rules: {}, cubes: [] });
  else rarityReq?.flush('boom', { status: 500, statusText: 'Server Error' });
}

describe('CubesDataService paging', () => {
  it('clamps a page past the end to the last page that exists', async () => {
    const { service, http, cubes } = setup(30);
    const result = firstValueFrom(service.getInscriptions(12, 99));
    answer(http, cubes, 'ok');
    const page = await result;

    // 30 cubes at 12 a page is three pages. Page 99 must land on three with
    // its six cubes, not on an empty grid under the words "all 30 cubes".
    expect(page.currentPage).toBe(3);
    expect(page.inscriptions.length).toBe(6);
    expect(page.totalInscriptions).toBe(30);
  });

  it('leaves a page inside the range alone', async () => {
    const { service, http, cubes } = setup(30);
    const result = firstValueFrom(service.getInscriptions(12, 2));
    answer(http, cubes, 'ok');
    const page = await result;
    expect(page.currentPage).toBe(2);
    expect(page.inscriptions.length).toBe(12);
  });

  it('clamps to page 1 when there are no cubes at all', async () => {
    const { service, http } = setup(0);
    const result = firstValueFrom(service.getInscriptions(12, 5));
    answer(http, [], 'ok');
    const page = await result;
    expect(page.currentPage).toBe(1);
    expect(page.inscriptions).toEqual([]);
  });

  it('says so when the rarity index could not be fetched', async () => {
    const { service, http, cubes } = setup(5);
    const result = firstValueFrom(service.getInscriptions(12, 1, 'rarity'));
    answer(http, cubes, 'down');
    const page = await result;

    // The gallery still renders, which is the point of swallowing that error.
    expect(page.inscriptions.length).toBe(5);
    // But the caller has to be able to tell, or it shows "Rarity" as the
    // applied order over cubes that are in a different one.
    expect(page.rarityAvailable).toBe(false);
    expect(page.rarity).toBeUndefined();
  });

  it('reports the index as available when it loads', async () => {
    const { service, http, cubes } = setup(5);
    const result = firstValueFrom(service.getInscriptions(12, 1, 'rarity'));
    answer(http, cubes, 'ok');
    const page = await result;
    expect(page.rarityAvailable).toBe(true);
  });
});
