import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Metadata } from '../types/metadata';

import { MintInfo } from '../types/mint-info';


@Injectable()
export class MetadataService {

  constructor(private configService: ConfigService) { }

  generateMetadata(
    allMints: MintInfo[],
    rawMetadata: Metadata[],
    createMetadataFn: (
      tokenId: number,
      mint: MintInfo,
      availableMetadata:
      Metadata[]) => Metadata,
    createMosaicMetadataFn: (
      tokenId: number,
      mosaicCounter: number,
      tokenTile1: Metadata,
      tokenTile2: Metadata,
      tokenTile3: Metadata,
      tokenTile4: Metadata,
      environment: string
    ) => Metadata,
    createFallbackImageFn: (
      tokenId: number
    ) => Metadata): Metadata[] {

    const environment = this.configService.get('environment');
    const availableRawMetadata = [...rawMetadata];
    const result: Metadata[] = []; // array index == tokenId!!
    let mosaicCounter = 0;

    allMints.forEach(mint => {

      const tokenId = mint.tokenId;
      let metadata: Metadata;

      if (!mint.isMosaic) {

        if (availableRawMetadata.length) {
          metadata = createMetadataFn(tokenId, mint, availableRawMetadata);
        } else {
          // we have a problem: we sold too much! :-/
          metadata = createFallbackImageFn(tokenId);
        }

      } else {

        mosaicCounter++;
        const tokenTile1 = result[mint.mosaics[0]];
        const tokenTile2 = result[mint.mosaics[1]];
        const tokenTile3 = result[mint.mosaics[2]];
        const tokenTile4 = result[mint.mosaics[3]];
        metadata = createMosaicMetadataFn(tokenId, mosaicCounter, tokenTile1, tokenTile2, tokenTile3, tokenTile4, environment);
      }

      result.push(metadata);

    });

    return result;
  }
}
