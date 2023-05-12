import { Injectable } from '@nestjs/common';
import axios from 'axios';
import sharp = require('sharp');

import { Metadata } from '../types/metadata';
import { CacheService } from './cache.service';


// Docs:
// https://www.npmjs.com/package/sharp

@Injectable()
export class ImageService {

  constructor(private cacheService: CacheService) { }

  async getPreview(allMints: Metadata[], tokenName: string, tokenId: number): Promise<Buffer> {

    const token = allMints.find(x =>  x.tokenId === tokenId);

    let imageBuffer: Buffer;

    if (!token.isMosaic) {
      // all non-mosiac images should have a rawImage, but fallback to image just to be sure
      imageBuffer = await this.getThumbnail(token.rawImage ? (token.rawImage as string): token.image, 400, 400);
    } else {
      imageBuffer = await this.getMosiacPreview(allMints, tokenName, tokenId);
    }

    return imageBuffer;
  }


  async getMosiacPreview(allMints: Metadata[], tokenName: string, tokenId: number): Promise<Buffer> {

    const cacheKey = 'mosiacPreview_' + tokenName + '_' + tokenId;
    return this.cacheService.loadCached(cacheKey, async () => {

      const token = allMints.find(x =>  x.tokenId === tokenId);
      const tile1 = allMints.find(x =>  x.tokenId === token.tile1TokenId);
      const tile2 = allMints.find(x =>  x.tokenId === token.tile2TokenId);
      const tile3 = allMints.find(x =>  x.tokenId === token.tile3TokenId);
      const tile4 = allMints.find(x =>  x.tokenId === token.tile4TokenId);

      const allImages = await Promise.all([
        this.getThumbnail(tile1.rawImage ? (tile1.rawImage as string): tile1.image),
        this.getThumbnail(tile2.rawImage ? (tile2.rawImage as string): tile2.image),
        this.getThumbnail(tile3.rawImage ? (tile3.rawImage as string): tile3.image),
        this.getThumbnail(tile4.rawImage ? (tile4.rawImage as string): tile4.image),
      ]);

      // Create a blank 402x402 PNG image with transparent background
      const image = await sharp({
        create: {
          width: 402,
          height: 402 ,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        }
      })
      /*
      Result:

      1  2
      3  4
      */
      .composite([
        { input: allImages[0], gravity: 'northwest' }, // 1
        { input: allImages[1], gravity: 'northeast' }, // 2
        { input: allImages[2], gravity: 'southwest' }, // 3
        { input: allImages[3], gravity: 'southeast' }, // 4
      ])
      .png()
      .toBuffer();

      return image;
    });
  }

  async getThumbnail(imagUrl: string, width = 200, height = 200): Promise<Buffer> {
    return this.cacheService.loadCached('thumbnail_' + imagUrl + '_' + width + '_' + height, async () => {

      const response = await axios.get(imagUrl, { responseType: 'arraybuffer' })
      const buffer = Buffer.from(response.data);
      return await sharp(buffer).resize({ width, height }).toBuffer();
    });
  }

  getAnimationHtml(tokenId: number, allMints: Metadata[], level = 1): string {

    const token = allMints.find(x =>  x.tokenId === tokenId);
    let imageUrl: string;

    if (level < 3) {
      imageUrl = token.rawImage ? (token.rawImage as string) : token.image;
    } else {
      // always use preview for deeper level to save bandwidth
      imageUrl =  token.image
    }

    return `${ '  '.repeat(level) }<div class="tile"><a href="${ token.external_url }" target="_top"><img src="${ imageUrl }" alt="" title="${ token?.name } (Token #${ tokenId })"></a></div>`;
  }

  getMosaicAnimationHtml(tokenId: number, tile1: number, tile2: number, tile3: number, tile4: number, allMints: Metadata[], level = 1): string {

      // token can be also null! (preview of unminted mosaic)
      const token = allMints.find(x =>  x.tokenId === tokenId);
      const tokenTile1 = allMints.find(x =>  x.tokenId === tile1);
      const tokenTile2 = allMints.find(x =>  x.tokenId === tile2);
      const tokenTile3 = allMints.find(x =>  x.tokenId === tile3);
      const tokenTile4 = allMints.find(x =>  x.tokenId === tile4);

      return `${ '  '.repeat(level) }<div class="mosaic" title="${ token?.name } (Token #${ tokenId })">
${ tokenTile1.isMosaic ? this.getMosaicAnimationHtml(
  tokenTile1.tokenId,
  tokenTile1.tile1TokenId as number,
  tokenTile1.tile2TokenId as number,
  tokenTile1.tile3TokenId as number,
  tokenTile1.tile4TokenId as number,
  allMints, level + 1) : this.getAnimationHtml(tokenTile1.tokenId, allMints, level + 1) }
${ tokenTile2.isMosaic ? this.getMosaicAnimationHtml(
  tokenTile2.tokenId,
  tokenTile2.tile1TokenId as number,
  tokenTile2.tile2TokenId as number,
  tokenTile2.tile3TokenId as number,
  tokenTile2.tile4TokenId as number,
  allMints, level + 1) : this.getAnimationHtml(tokenTile2.tokenId, allMints, level + 1) }
${ tokenTile3.isMosaic ? this.getMosaicAnimationHtml(
  tokenTile3.tokenId,
  tokenTile3.tile1TokenId as number,
  tokenTile3.tile2TokenId as number,
  tokenTile3.tile3TokenId as number,
  tokenTile3.tile4TokenId as number,
  allMints, level + 1) : this.getAnimationHtml(tokenTile3.tokenId, allMints, level + 1) }
${ tokenTile4.isMosaic ? this.getMosaicAnimationHtml(
  tokenTile4.tokenId,
  tokenTile4.tile1TokenId as number,
  tokenTile4.tile2TokenId as number,
  tokenTile4.tile3TokenId as number,
  tokenTile4.tile4TokenId as number,
  allMints, level + 1) : this.getAnimationHtml(tokenTile4.tokenId, allMints, level + 1) }
${ '  '.repeat(level) }</div>`;
  }
}
