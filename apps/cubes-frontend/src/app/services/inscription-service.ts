import { Injectable } from '@angular/core';
import axios from 'axios';

/**
 * Service for extracting the inscription from a Bitcoin transaction.
 * Ported from https://github.com/crustyapples/ordinals-playground/blob/main/inscription-parser.py
 */
@Injectable({ providedIn: 'root' })
export class BitcoinInscriptionService {

  private pointer = 0;
  private raw: Uint8Array = new Uint8Array();

  /**
   * Fetches raw transaction data using the provided transaction ID.
   * @param txId - The transaction ID.
   * @returns A promise that resolves to the raw data.
   */
  private async getRawData(txId: string): Promise<Uint8Array> {
      const url = `https://mempool.space/api/tx/${txId}`;
      const response = await axios.get(url);
      if (response.status !== 200) {
          throw new Error(`Failed to retrieve transaction data for ${txId} from the API`);
      }

      const txWitness = response.data.vin[0].witness.join('');
      return new Uint8Array(txWitness.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)));
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

  private getInitialPosition(): number {
      const inscriptionMark = new Uint8Array([0x00, 0x63, 0x03, 0x6f, 0x72, 0x64]);
      const position = this.raw.findIndex((byte, index) =>
          this.raw.slice(index, index + inscriptionMark.length).every((val, i) => val === inscriptionMark[i])
      );
      if (position === -1) {
          throw new Error('No ordinal inscription found in transaction');
      }
      return position + inscriptionMark.length;
  }

  private readContentType(): string {
      const OP_1 = 0x51;
      const firstByte = this.readBytes(1)[0];
      if (firstByte !== OP_1 && firstByte !== 0x01) {
          throw new Error('Unexpected byte encountered while reading content type');
      }
      if (firstByte === 0x01) {
          if (this.readBytes(1)[0] !== 0x01) {
              throw new Error('Invalid sequence encountered while reading content type');
          }
      }
      const size = this.readBytes(1)[0];
      return new TextDecoder().decode(this.readBytes(size));
  }

  readPushdata(): Uint8Array {
      const opcode = this.readBytes(1)[0];

      if (0x01 <= opcode && opcode <= 0x4b) {
          return this.readBytes(opcode);
      }

      let numBytes: number;
      switch (opcode) {
          case 0x4c: numBytes = 1; break;
          case 0x4d: numBytes = 2; break;
          case 0x4e: numBytes = 4; break;
          default:
              throw new Error(`Invalid push opcode ${opcode.toString(16)} at position ${this.pointer - 1}`);
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
      if (this.readBytes(1)[0] !== 0x00) {
          throw new Error('Expected byte after content type not found');
      }

      const data: Uint8Array[] = [];
      while (this.pointer < this.raw.length && this.raw[this.pointer] !== 0x68) {  // 0x68 is OP_ENDIF
          data.push(this.readPushdata());
      }

      const combinedData = new Uint8Array(data.reduce((acc, val) => acc + val.length, 0));
      let idx = 0;
      for (const segment of data) {
          combinedData.set(segment, idx);
          idx += segment.length;
      }

      const base64Data = btoa(String.fromCharCode(...combinedData));
      console.log(base64Data);
      return `data:${contentType};base64,${base64Data}`;
  }
}



//   /**
//    * Get the inscription from a given transaction ID.
//    * @param txId The transaction ID.
//    * @returns The inscription as a data-uri.
//    */
//   public async getInscription(txId: string): Promise<string> {
//     const raw = await this.getRawData(txId);
//     let pointer = this.getInitialPosition(raw);
//     const { contentType, pointer: newPointer } = this.readContentType(raw, pointer);
//     pointer = newPointer;

//     const dataArray = [];

//     const OP_ENDIF = 0x68;
//     let opcode = raw[pointer];
//     pointer++;

//     while (opcode !== OP_ENDIF) {
//       const { data, pointer: newPointer } = this.readPushdata(raw, pointer);
//       dataArray.push(data);
//       pointer = newPointer;
//       opcode = raw[pointer];
//       pointer++;

//       this.debugDataArray(dataArray);
//     }

//     const dataConcatenated = new Uint8Array(dataArray.reduce((acc, curr) => acc + curr.length, 0));
//     let dataPointer = 0;
//     for (const dataChunk of dataArray) {
//       dataConcatenated.set(dataChunk, dataPointer);
//       dataPointer += dataChunk.length;
//     }

//     const dataBase64 = this.uint8ArrayToBase64(dataConcatenated);
//     return `data:${contentType};base64,${dataBase64}`;
//   }



// }



//   /**
//    * Convert a hex string to a Uint8Array.
//    * @param hex The hex string.
//    * @returns The corresponding Uint8Array.
//    */
//   private hexToUint8Array(hex: string): Uint8Array {
//     return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
//   }

//   /**
//    * Convert a Uint8Array to a base64 string.
//    * @param bytes The Uint8Array.
//    * @returns The corresponding base64 string.
//    */
//   private uint8ArrayToBase64(bytes: Uint8Array): string {
//     let binary = '';
//     bytes.forEach((byte) => binary += String.fromCharCode(byte));
//     return window.btoa(binary);
//   }

//   /**
//    * Convert a Uint8Array to a UTF8 string.
//    * @param bytes - The byte array to convert.
//    * @returns The corresponding UTF8 string.
//    */
//   private uint8ArrayToString(bytes: Uint8Array): string {
//     const decoder = new TextDecoder('utf-8');
//     return decoder.decode(bytes);
//   }


//   debugDataArray(dataArray: any[]) {
//     const dataConcatenated = new Uint8Array(dataArray.reduce((acc, curr) => acc + curr.length, 0));
//     let dataPointer = 0;
//     for (const dataChunk of dataArray) {
//       dataConcatenated.set(dataChunk, dataPointer);
//       dataPointer += dataChunk.length;
//     }

//     const content = this.uint8ArrayToString(dataConcatenated);
//     console.log(content);
//   }
