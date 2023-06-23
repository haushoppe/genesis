import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MempoolTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: Vin[];
  vout: Vout[];
  size: number;
  weight: number;
  fee: number;
  status: Status;
}

export interface Vin {
  txid: string;
  vout: number;
  prevout: Prevout;
  scriptsig: string;
  scriptsig_asm: string;
  witness: string[];
  is_coinbase: boolean;
  sequence: number;
}

export interface Prevout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}

export interface Vout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}

export interface Status {
  confirmed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MempoolService {
  private readonly baseApiUrl = 'https://mempool.space/api/address';

  http = inject(HttpClient);

  /**
   * Gets unconfirmed transaction history for the specified address/scripthash.
   * Returns up to 50 transactions.
   *
   * @param address The bitcoin address or scripthash
   * @returns An observable array of unconfirmed transactions
   */
  getUnconfirmedTransactions(address: string): Observable<MemmpoolTransaction[]> {
    return this.http.get<MemmpoolTransaction[]>(`${this.baseApiUrl}/${address}/txs/mempool`);
  }
}
