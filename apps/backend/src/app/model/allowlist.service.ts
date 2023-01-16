import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as Papa from 'papaparse';
import * as path from 'path';

import { AllowlistEntry } from '../types/allowlist-entry';


@Injectable()
export class AllowlistService {

  allowlistFolder = path.resolve(__dirname + '/assets/data/');
  private cachedMintWallets: { [tokenName: string]: string[] } = {};

  getMintWallets(tokenName: string): string[] {

    let mintWallets = this.cachedMintWallets[tokenName];
    if (mintWallets) {
      return mintWallets
    }

    const entries = this.parseHeymintCsvFromFile('allowlist_' + tokenName + '.csv');
    mintWallets = entries.map(x => x.mintWallet);
    this.cachedMintWallets[tokenName] = mintWallets;
    return mintWallets;
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
