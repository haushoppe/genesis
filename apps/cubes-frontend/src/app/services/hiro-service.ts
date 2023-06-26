import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Represents an inscription object.
 *
 * GET https://api.hiro.so/ordinals/v1/inscriptions/{id}

  Example Result:
  {
      "id": "1463d48e9248159084929294f64bda04487503d30ce7ab58365df1dc6fd58218i0",
      "number": 248751,
      "address": "bc1p9wqzd883jxmymm0fger6mhaxy7xy4mg835ahg05d2pa7dz5j7musl568tf",
      "genesis_address": "bc1pvwh2dl6h388x65rqq47qjzdmsqgkatpt4hye6daf7yxvl0z3xjgq247aq8",
      "genesis_block_height": 778921,
      "genesis_block_hash": "00000000000000000000615da470d42284a2ab797daf6fe44fc3c2579f2756a1",
      "genesis_tx_id": "1463d48e9248159084929294f64bda04487503d30ce7ab58365df1dc6fd58218",
      "genesis_fee": "3179",
      "genesis_timestamp": 1677732036000,
      "tx_id": "2a51431e5ceba8e75e85f0720056719fca8dbf68de3858571bcaf4e8426879d0",
      "location": "2a51431e5ceba8e75e85f0720056719fca8dbf68de3858571bcaf4e8426879d0:0:2000",
      "output": "2a51431e5ceba8e75e85f0720056719fca8dbf68de3858571bcaf4e8426879d0:0",
      "value": "2546",
      "offset": "2000",
      "sat_ordinal": "1232735286933201",
      "sat_rarity": "common",
      "sat_coinbase_height": 283094,
      "mime_type": "text/plain",
      "content_type": "text/plain;charset=utf-8",
      "content_length": 59,
      "timestamp": 1677805522000
  }

 */
export interface Inscription {
  id: string;
  number: number;
  address: string;
  genesis_address: string;
  genesis_block_height: number;
  genesis_block_hash: string;
  genesis_tx_id: string;
  genesis_fee: string;
  genesis_timestamp: number;
  tx_id: string;
  location: string;
  output: string;
  value: string;
  offset: string;
  sat_ordinal: string;
  sat_rarity: string;
  sat_coinbase_height: number;
  mime_type: string;
  content_type: string;
  content_length: number;
  timestamp: number;
}

/**
 * The service responsible for interacting with the Hiro.so ordinals API.
 */
@Injectable({
  providedIn: 'root'
})
export class HiroService {

  // Base URL for the Hiro API
  private readonly baseURL = 'https://api.hiro.so/ordinals/v1/inscriptions/';

  /**
   * Constructs the HiroService.
   * @param {HttpClient} http - Angular's HttpClient for making API requests.
   */
  constructor(private http: HttpClient) { }

  /**
   * Fetches the inscription data for the given id from the Hiro API.
   *
   * @param {string} id - The inscription ID or number.
   * @returns {Observable<Inscription>} - An Observable that resolves to the inscription data.
   */
  getInscription(id: string): Observable<Inscription> {
    return this.http.get<Inscription>(`${this.baseURL}${id}`);
  }
}
