import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Metadata } from '../types/metadata';

import { MintInfo } from '../types/mint-info';
import { PseudoRandom } from './pseudo-random';


@Injectable()
export class MetadataService {

  constructor(private configService: ConfigService) { }

  generateMetadata(
    allMints: MintInfo[],
    rawMetadata: Metadata[],
    createMosaicMetadataFn: (
      tokenId: number,
      mosaicCounter: number,
      tokenTile1: Metadata,
      tokenTile2: Metadata,
      tokenTile3: Metadata,
      tokenTile4: Metadata,
      environment: string
    ) => Metadata,
    createFallbackImageFn: (tokenId: number) => Metadata): Metadata[] {

    const environment = this.configService.get('environment');
    const availableMetadata = [...rawMetadata];
    const results: Metadata[] = []; // array index == tokenId!!
    let mosaicCounter = 0;

    allMints.forEach(mint => {

      const tokenId = mint.tokenId;

      if (!mint.isMosaic) {

        if (availableMetadata.length) {
          const r = new PseudoRandom(mint.transactionHash);
          const randomIndex = r.randomInt(0, availableMetadata.length - 1);
          const metadata = {
            ...getAndRemoveItem(availableMetadata, randomIndex),
            tokenId
          };
          results.push(metadata);
        } else {
          // we have a problem: we sold too much! :-/
          results.push(createFallbackImageFn(tokenId));
        }

      } else {

        mosaicCounter++;
        const tokenTile1 = results[mint.mosaics[0]];
        const tokenTile2 = results[mint.mosaics[1]];
        const tokenTile3 = results[mint.mosaics[2]];
        const tokenTile4 = results[mint.mosaics[3]];

        const metadata = createMosaicMetadataFn(tokenId, mosaicCounter, tokenTile1, tokenTile2, tokenTile3, tokenTile4, environment);
        results.push(metadata);
      }
    });

    return results;
  }
}

/**
 * Changes the content of an array by removing the existing elements at the index
 * @param index to remove
 * @returns removed item
 */
function getAndRemoveItem<T>(arr: Array<T>, index: number): T {
  const el = arr[index];
  arr.splice(index, 1);
  return el;
}
