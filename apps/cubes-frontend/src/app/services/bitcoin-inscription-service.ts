import { Injectable } from '@angular/core';
import axios from 'axios';

/**
 * Bitcoin Script Opcodes,
 * see https://en.bitcoin.it/wiki/Script
 */
const OP_FALSE = 0x00;
const OP_IF = 0x63
const OP_0 = 0x00;

const OP_PUSHBYTES_1 = 0x01; // not an actual opcode, but used in documentation --> pushes the next byte onto the stack.
const OP_PUSHBYTES_3 = 0x03; // not an actual opcode, but used in documentation --> pushes the next 3 bytes onto the stack.
const OP_PUSHDATA1 = 0x4c; // The next byte contains the number of bytes to be pushed onto the stack.
const OP_PUSHDATA2 = 0x4d; // The next two bytes contain the number of bytes to be pushed onto the stack in little endian order.
const OP_PUSHDATA4 = 0x4e; // The next four bytes contain the number of bytes to be pushed onto the stack in little endian order.
const OP_1 = 0x51; // The number 1 is pushed onto the stack.
const OP_ENDIF = 0x68; // Ends an if/else block.

/**
 * Extracts the first inscription from a Bitcoin transaction.
 * Advanced envelopes with extra data (eg Quadkey inscriptions) are supported, but the extra data is ignored.
 *
 *
 * ++ Example of usage:
 *
 * const txId = '78fa9d6e9b2b49fbb9f4838e1792dba7c1ec836f22e3206561e2d52759708251';
 * const service = new BitcoinInscriptionService();
 * const dataBase64 = await service.getInscription(txId);
 * console.log(dataBase64);
 *
 *
 * ++ Simple envelope:
 *
 * OP_FALSE
 * OP_IF
 *   OP_PUSH "ord"                      ---> OP_PUSHBYTES_3 "ord"
 *   OP_PUSH 1                          ---> OP_PUSHBYTES_1 1
 *   OP_PUSH "text/plain;charset=utf-8" ---> OP_PUSHBYTES_24 "text/plain;charset=utf-8"
 *   OP_0
 *   OP_PUSH "Hello, world!"            ---> OP_PUSHBYTES_13 "Hello, world!"
 * OP_ENDIF
 *
 *
 * ++ Larger envelope:
 *
 * OP_FALSE
 * OP_IF
 *   OP_PUSH "ord"                      ---> OP_PUSHBYTES_3 "ord"
 *   OP_PUSH 1                          ---> OP_PUSHBYTES_1
 *   OP_PUSH "text/html"                ---> OP_PUSHBYTES_9 746578742f68746d6c
 *   OP_0
 *   OP_PUSH "<html>long text..."       ---> OP_PUSHDATA2, <2 Bytes Lenght>, data
 *   OP_0
 *   OP_PUSH "...long text</html>"      ---> OP_PUSHDATA1, <1 Byte Lenght>, data
 * OP_ENDIF
 *
 * Code ported from https://github.com/crustyapples/ordinals-playground/blob/main/inscription-parser.py
 * Read more here: https://blog.ordinalhub.com/what-is-an-envelope/
 *
 * Tested with the following transactions:
 * 78fa9d6e9b2b49fbb9f4838e1792dba7c1ec836f22e3206561e2d52759708251 --> my html inscription (text/html)
 * b67f68d65fae02205199c511f891d3dabd5f9c7bfee55cdfbf4b320522ec4c31 --> some random brc-20 inscription (text/plain;charset=utf-8)
 * c1e013bdd1434450c6e1155417c81eb888e20cbde2e0cde37ec238d91cf37045 --> some random "Hello, world!" inscription (text/plain;charset=utf-8)
 * f531eea03671ac17100a9887d5212532250d5eae09e7c8873cdd2efa6f7fab57 --> some random Quadkey
 */
@Injectable({ providedIn: 'root' })
export class BitcoinInscriptionService {

  private pointer = 0;
  private raw: Uint8Array = new Uint8Array();

  /**
   * Converts a hex string to a Uint8Array.
   *
   * @param {string} hexStr - The hex string to be converted.
   * @returns {Uint8Array} - The resulting Uint8Array.
   */
  private hexStringToUint8Array(hex: string): Uint8Array {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  }

  /**
   * Fetches raw transaction data from the mempool.space API.
   *
   * @param txId - The transaction ID.
   * @returns A promise that resolves to the raw data.
   */
  private async getRawData(txId: string): Promise<Uint8Array> {
    const url = `https://mempool.space/api/tx/${txId}`;
    const response = await axios.get(url);
    const txWitness = response.data.vin[0].witness.join('');
    return this.hexStringToUint8Array(txWitness);
  }

  /**
   * Reads n bytes from the raw data starting from the current pointer.
   * Also updates the pointer after reading.
   * @param n - The number of bytes to read.
   * @returns The read bytes as Uint8Array.
   */
  private readBytes(n: number): Uint8Array {
    const slice = this.raw.slice(this.pointer, this.pointer + n);
    this.pointer += n;
    return slice;
  }

  /**
   * Identifies the initial position of the ordinal inscription in the raw transaction data.
   *
   * @returns The starting position of the inscription.
   */
  private getInitialPosition(): number {

    // OP_FALSE
    // OP_IF
    // OP_PUSHBYTES_3: This pushes the next 3 bytes onto the stack.
    // 0x6f, 0x72, 0x64: These bytes translate to the ASCII string "ord"
    const inscriptionMark = new Uint8Array([OP_FALSE, OP_IF, OP_PUSHBYTES_3, 0x6f, 0x72, 0x64]);

    const position = this.raw.findIndex((_byte, index) =>
      this.raw.slice(index, index + inscriptionMark.length).every((val, i) => val === inscriptionMark[i])
    );

    if (position === -1) {
      throw new Error('No ordinal inscription found in transaction');
    }
    return position + inscriptionMark.length;
  }

  /**
   * Convert a Uint8Array to a UTF8 string.
   * @param bytes - The byte array to convert.
   * @returns The corresponding UTF8 string.
   */
  private uint8ArrayToString(bytes: Uint8Array): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  }

  /**
   * Reads the content type of the inscription from the raw transaction data.
   * Hint: docs.ordinals.com had an incorrect example showing OP_1 instead of OP_PUSH 1
   *
   * References:
   * - The Cursed Inscriptions Rabbithole: https://youtu.be/cpAh5_KhvMg
   * - https://github.com/ordinals/ord/issues/1896
   *
   * @returns The content type.
   */
  private readContentType(): string {

    const firstByte = this.readBytes(1)[0];

    // OP_PUSH 1
    if (firstByte === OP_PUSHBYTES_1) {
      const secondByte: number = this.readBytes(1)[0];
      if (secondByte !== 0x01) {
        throw new Error("Invalid envelope, expected 0x01 after OP_PUSHBYTES_1.");
      }
    }
    // cursed OP_1
    else if (firstByte !== OP_1) {
      throw new Error("Invalid envelope, expected cursed OP_1 if OP_PUSH 1 is not present.");
    }

    const size = this.readBytes(1)[0];
    return this.uint8ArrayToString(this.readBytes(size));
  }

  /**
   * Reads the data using the starting opcode
   *
   * @returns The data extracted based on the opcode.
   */
  readPushdata(): Uint8Array {
    const opcode = this.readBytes(1)[0];

    // Opcodes from 0x01 to 0x4b (decimal values 1 to 75) are special opcodes that indicate a data push is happening.
    // Specifically, they indicate the number of bytes to be pushed onto the stack.
    // This checks if the current opcode represents a direct data push of 1 to 75 bytes.
    // If this condition is true, then read the next opcode number of bytes and treat them as data
    if (0x01 <= opcode && opcode <= 0x4b) {
      return this.readBytes(opcode);
    }

    let numBytes: number;
    switch (opcode) {
      case OP_PUSHDATA1: numBytes = 1; break;
      case OP_PUSHDATA2: numBytes = 2; break;
      case OP_PUSHDATA4: numBytes = 4; break;
      default:
        throw new Error(`Invalid push opcode ${opcode.toString(16)} at position ${this.pointer}`);
    }

    const dataSizeArray = this.readBytes(numBytes);
    let dataSize = 0;
    for (let i = 0; i < numBytes; i++) {
      dataSize |= dataSizeArray[i] << (8 * i);
    }
    return this.readBytes(dataSize);
  }

  /**
   * Main function that fetches the inscription from a transaction using its ID.
   * @param txId - The transaction ID.
   * @returns A promise that resolves to the inscription as a data-uri.
   */
  async getInscription(txId: string): Promise<string> {
    this.raw = await this.getRawData(txId);
    this.pointer = this.getInitialPosition();
    const contentType = this.readContentType();

    // Skip bytes until OP_0 is found
    // this way we can support advanced envelopes without understanding them
    while (this.pointer < this.raw.length && this.readBytes(1)[0] !== OP_0) {
      // do nothing, just increment the pointer by reading bytes
    }

    // this creates an array of Uint8Array
    const data: Uint8Array[] = [];
    while (this.pointer < this.raw.length && this.raw[this.pointer] !== OP_ENDIF) {
      data.push(this.readPushdata());
    }

    const combinedLengthOfAllArrays = data.reduce((acc, curr) => acc + curr.length, 0);
    const combinedData = new Uint8Array(combinedLengthOfAllArrays);

    // copy all segments from data into combinedData, forming a single contiguous Uint8Array
    let idx = 0;
    for (const segment of data) {
      combinedData.set(segment, idx);
      idx += segment.length;
    }

    // for debugging text-based inscriptions
    // console.log(',', this.uint8ArrayToString(combinedData), ',');

    const base64Data = window.btoa(String.fromCharCode(...combinedData));
    return `data:${contentType};base64,${base64Data}`;
  }
}
