import { Injectable } from '@angular/core';
import axios from 'axios';

/**
 * Service for extracting the inscription from a Bitcoin transaction.
 * Ported from https://github.com/crustyapples/ordinals-playground/blob/main/inscription-parser.py
 */
@Injectable({ providedIn: 'root' })
export class BitcoinInscriptionService {

  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  /**
   * Convert a hex string to a Uint8Array.
   * @param hex The hex string.
   * @returns The corresponding Uint8Array.
   */
  private hexToUint8Array(hex: string): Uint8Array {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  }

  /**
   * Convert a Uint8Array to a base64 string.
   * @param bytes The Uint8Array.
   * @returns The corresponding base64 string.
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((byte) => binary += String.fromCharCode(byte));
    return window.btoa(binary);
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
   * Fetch the raw data for a given transaction ID.
   * @param txId The transaction ID.
   * @returns The raw data as a Uint8Array.
   */
  private async getRawData(txId: string): Promise<Uint8Array> {
    const url = `https://mempool.space/api/tx/${txId}`;
    const response = await axios.get(url);

    if (response.status !== 200) {
      throw new Error(`Failed to retrieve transaction data for ${txId} from the API`);
    }

    const txWitness = response.data.vin[0].witness.join("");
    return this.hexToUint8Array(txWitness);
  }

  /**
   * Find the initial position of the inscription mark in the raw data.
   * @param raw The raw data.
   * @returns The position.
   */
  private getInitialPosition(raw: Uint8Array): number {
    const inscriptionMark = this.hexToUint8Array("0063036f7264");

    // Implementing indexOf for Uint8Array
    for (let i = 0; i < raw.length - inscriptionMark.length + 1; i++) {
      let j = 0;
      while (j < inscriptionMark.length && raw[i + j] === inscriptionMark[j]) {
        j++;
      }
      if (j === inscriptionMark.length) {
        return i + j; // returning the position after the mark
      }
    }

    throw new Error("No ordinal inscription found in transaction");
  }

  /**
   * Read the content type from the raw data at a given position.
   * @param raw The raw data.
   * @param pointer The current position.
   * @returns The content type and the updated pointer.
   */
  private readContentType(raw: Uint8Array, pointer: number): { contentType: string, pointer: number } {
    const OP_1 = 0x51;

    const byte = raw[pointer];
    pointer++;

    if (byte !== OP_1 && byte !== 0x01) {
      throw new Error("Unexpected byte value");
    }

    if (byte === 0x01) {
      pointer++;
    }

    const size = raw[pointer];
    pointer++;

    const contentType = this.decoder.decode(raw.slice(pointer, pointer + size));
    pointer += size;

    return { contentType, pointer };
  }

  /**
   * Read data based on the pushdata opcode.
   * @param raw The raw data.
   * @param pointer The current position.
   * @returns The data and the updated pointer.
   */
  private readPushdata(raw: Uint8Array, pointer: number): { data: Uint8Array, pointer: number } {
    const intOpcode = raw[pointer];
    pointer++;

    if (0x01 <= intOpcode && intOpcode <= 0x4b) {
      const size = intOpcode;
      const data = raw.slice(pointer, pointer + size);
      pointer += size;
      return { data, pointer };
    }

    let dataSize = 0;

    switch (intOpcode) {
      case 0x4c:
        dataSize = raw[pointer];
        pointer++;
        break;
      case 0x4d:
        if (pointer + 1 >= raw.length) {
          throw new Error('Unexpected end of data when reading dataSize.');
        }
        dataSize = (raw[pointer] | (raw[pointer + 1] << 8));
        pointer += 2;
        break;
      case 0x4e:
        if (pointer + 3 >= raw.length) {
          throw new Error('Unexpected end of data when reading dataSize.');
        }
        dataSize = (raw[pointer] | (raw[pointer + 1] << 8) | (raw[pointer + 2] << 16) | (raw[pointer + 3] << 24));
        pointer += 4;
        break;
      default:
        throw new Error(`Invalid push opcode ${intOpcode.toString(16)} at position ${pointer}`);
    }

    if (pointer + dataSize > raw.length) {
      throw new Error('Data size exceeds the bounds of the data array.');
    }

    const data = raw.slice(pointer, pointer + dataSize);
    pointer += dataSize;

    return { data, pointer };
  }



  /**
   * Get the inscription from a given transaction ID.
   * @param txId The transaction ID.
   * @returns The inscription as a data-uri.
   */
  public async getInscription(txId: string): Promise<string> {
    const raw = await this.getRawData(txId);
    let pointer = this.getInitialPosition(raw);
    const { contentType, pointer: newPointer } = this.readContentType(raw, pointer);
    pointer = newPointer;

    const dataArray = [];

    const OP_ENDIF = 0x68;
    let opcode = raw[pointer];
    pointer++;

    while (opcode !== OP_ENDIF) {
      const { data, pointer: newPointer } = this.readPushdata(raw, pointer);
      dataArray.push(data);
      pointer = newPointer;
      opcode = raw[pointer];
      pointer++;

      this.debugDataArray(dataArray);
    }

    const dataConcatenated = new Uint8Array(dataArray.reduce((acc, curr) => acc + curr.length, 0));
    let dataPointer = 0;
    for (const dataChunk of dataArray) {
      dataConcatenated.set(dataChunk, dataPointer);
      dataPointer += dataChunk.length;
    }

    const dataBase64 = this.uint8ArrayToBase64(dataConcatenated);
    return `data:${contentType};base64,${dataBase64}`;
  }

  debugDataArray(dataArray: any[]) {
    const dataConcatenated = new Uint8Array(dataArray.reduce((acc, curr) => acc + curr.length, 0));
    let dataPointer = 0;
    for (const dataChunk of dataArray) {
      dataConcatenated.set(dataChunk, dataPointer);
      dataPointer += dataChunk.length;
    }

    const content = this.uint8ArrayToString(dataConcatenated);
    console.log(content);
  }

}


