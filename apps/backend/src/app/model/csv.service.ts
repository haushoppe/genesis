import { Injectable } from '@nestjs/common';
import * as Papa from 'papaparse';
import { AllowlistEntry } from './allowlist-entry';

@Injectable()
export class CsvService {

  parseHeymintCsvFromFile(path: string): AllowlistEntry[] {


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
