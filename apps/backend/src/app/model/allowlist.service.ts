import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as Papa from 'papaparse';
import * as path from 'path';

import { AllowlistEntry } from '../types/allowlist-entry';
import { CacheService } from './cache.service';


@Injectable()
export class AllowlistService {

  constructor(private cacheService: CacheService) { }

  allowlistFolder = path.resolve(__dirname + '/assets/data/');

  getMintWallets(tokenName: string): string[] {
    return this.cacheService.loadCachedSync('mintWallets_' + tokenName, () => {

      const entries = this.parseHeymintCsvFromFile('allowlist_' + tokenName + '.csv');
      return entries.map(x => x.mintWallet);
    });
  }

  parseHeymintCsvFromFile(filename: string): AllowlistEntry[] {

    const resolvedFilename = path.resolve(this.allowlistFolder, filename);

    if (!fs.existsSync(resolvedFilename)) {
      return [];
    }

    const csv = fs.readFileSync(resolvedFilename, { encoding:'utf8', flag:'r' });
    return this.parseHeymintCsv(csv);
  }

  parseHeymintCsv(csv: string): AllowlistEntry[] {

    const results = Papa.parse(csv, {
      delimiter: ',',
      header: true,
      skipEmptyLines: true
    });

    return results.data as AllowlistEntry[];
  }
}
