import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

// A chain with no cubes index and no archive, as on regtest. The real
// environment is spread and only the two bases are emptied, so every other
// field stays whatever the app ships.
vi.mock('../../../environments/environment', async () => {
  const actual = await vi.importActual<typeof import('../../../environments/environment')>(
    '../../../environments/environment',
  );
  return { environment: { ...actual.environment, cubesIndexBase: '', archiveBase: '' } };
});

import { ArchiveDataService } from './archive-data.service';
import { RarityService } from './rarity.service';

/**
 * An empty base means "no such source on this chain", and the services then
 * answer without a request. Without that, a regtest run reads the mainnet
 * index and archive from production.
 */
describe('a chain without a cubes index or an archive', () => {
  afterEach(() => vi.restoreAllMocks());

  it('answers the rarity index as empty and makes no request', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    const rarity = TestBed.inject(RarityService);
    const http = TestBed.inject(HttpTestingController);

    const index = await firstValueFrom(rarity.getIndex());

    expect(index.scoredCubes).toBe(0);
    expect(index.cubes).toEqual([]);
    await expect(firstValueFrom(rarity.getRarity(`${'a'.repeat(64)}i0`))).resolves.toBeNull();
    http.verify();
  });

  it('rejects archive reads without fetching anything', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const archive = new ArchiveDataService();

    await expect(archive.getCollections()).rejects.toThrow('No Magic Eden archive is configured for this chain');
    await expect(archive.getInscriptions('any-symbol')).rejects.toThrow('No Magic Eden archive is configured for this chain');
    expect(fetchSpy.mock.calls).toEqual([]);
  });
});
