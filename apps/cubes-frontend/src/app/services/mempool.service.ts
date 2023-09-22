import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { TransactionDetail } from './mempool.service.transaction-details.types';
import { MempoolTransaction } from './mempool.service.unconfirmed-transactions.types';

@Injectable({
  providedIn: 'root'
})
export class MempoolService {
  private readonly baseApiUrl = 'https://mempool.space/api';

  httpClient = inject(HttpClient);

  /**
   * Gets unconfirmed transaction history for the specified address/scripthash.
   * Returns up to 50 transactions.
   *
   * @param address The bitcoin address or scripthash
   * @returns An observable array of unconfirmed transactions
   */
  getUnconfirmedTransactions(address: string): Observable<MempoolTransaction[]> {
    return this.httpClient.get<MempoolTransaction[]>(`${this.baseApiUrl}/address/${address}/txs/mempool`);
  }

  /**
   * Fetches detailed information about a specific transaction.
   *
   * @param {string} txid - The ID of the transaction.
   * @returns {Observable<TransactionDetail>} - Observable containing transaction details.
   */
  getTransactionDetails(txid: string): Observable<TransactionDetail> {
    const endpoint = `${this.baseApiUrl}/tx/${txid}`;
    return this.httpClient.get<TransactionDetail>(endpoint);
  }
}
