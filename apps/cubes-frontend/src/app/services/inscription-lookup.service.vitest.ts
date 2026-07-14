import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { cat21Config } from 'ordpool-sdk';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InscriptionLookupService } from './inscription-lookup.service';

const TEST_ORD_URL = 'https://test.ord.example';

describe('InscriptionLookupService', () => {
  let svc: InscriptionLookupService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: cat21Config,
          useValue: {
            mempoolApiUrl: '',
            cat21ApiUrl: '',
            ordApiUrl: TEST_ORD_URL,
            cat21OrdApiUrl: '',
          },
        },
      ],
    });
    svc = TestBed.inject(InscriptionLookupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns the id from ord-proxy on success', async () => {
    const promise = firstValueFrom(svc.lookupById('12345'));
    const req = httpMock.expectOne(`${TEST_ORD_URL}/inscription/12345`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'abcdef' + '0'.repeat(58) + 'i0' });
    await expect(promise).resolves.toBe('abcdef' + '0'.repeat(58) + 'i0');
  });

  it('returns null when ord-proxy returns no id', async () => {
    const promise = firstValueFrom(svc.lookupById('99999'));
    httpMock.expectOne(`${TEST_ORD_URL}/inscription/99999`).flush({});
    await expect(promise).resolves.toBeNull();
  });

  it('returns null on HTTP error', async () => {
    const promise = firstValueFrom(svc.lookupById('404'));
    httpMock
      .expectOne(`${TEST_ORD_URL}/inscription/404`)
      .flush('not found', { status: 404, statusText: 'Not Found' });
    await expect(promise).resolves.toBeNull();
  });
});
