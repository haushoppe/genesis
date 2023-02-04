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

  async getMosiacPreview(tokenName: string, tokenId: number, mosaic: Metadata): Promise<Buffer> {

    const cacheKey = 'mosiacPreview_' + tokenName + '_' + tokenId;
    if (this.cacheService.has(cacheKey)) {
      return this.cacheService.get<Buffer>(cacheKey);
    }

    const allImages = await Promise.all([
      this.getThumbnail(mosaic.tile1Image as string),
      this.getThumbnail(mosaic.tile2Image as string),
      this.getThumbnail(mosaic.tile3Image as string),
      this.getThumbnail(mosaic.tile4Image as string),
    ]);

    // Create a blank 400x400 PNG image with transparent background
    const image = await sharp({
      create: {
        width: 404,
        height: 404,
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
    .toBuffer()

    return this.cacheService.set(cacheKey, image);
  }

  async getThumbnail(imagUrl: string) {
    const response = await axios.get(imagUrl, { responseType: 'arraybuffer' })
    const buffer = Buffer.from(response.data);
    return await sharp(buffer).resize({ width: 200, height: 200 }).toBuffer();
  }

  getAnimationHtml(tokenId: number, allMints: Metadata[]) {

    const token = allMints.find(x =>  x.tokenId === tokenId);
    return `<div class="tile"><a href="${ token.animation_url }"><img src="${ token.image }" alt="" title="${ token?.name } (Token #${ tokenId })"></a></div>`;
}

  getMosaicAnimationHtml(tokenId: number, tile1: number, tile2: number, tile3: number, tile4: number, allMints: Metadata[]) {

        // token can be also null!
      const token = allMints.find(x =>  x.tokenId === tokenId);
      const tokenTile1 = allMints.find(x =>  x.tokenId === tile1);
      const tokenTile2 = allMints.find(x =>  x.tokenId === tile2);
      const tokenTile3 = allMints.find(x =>  x.tokenId === tile3);
      const tokenTile4 = allMints.find(x =>  x.tokenId === tile4);

      return `<div class="mosaic">
${ tokenTile1.isMosaic ? this.getMosaicAnimationHtml(
  tokenTile1.tokenId,
  tokenTile1.tile1TokenId as number,
  tokenTile1.tile2TokenId as number,
  tokenTile1.tile3TokenId as number,
  tokenTile1.tile4TokenId as number,
  allMints) : this.getAnimationHtml(tokenTile1.tokenId, allMints) }
${ tokenTile2.isMosaic ? this.getMosaicAnimationHtml(
  tokenTile2.tokenId,
  tokenTile2.tile1TokenId as number,
  tokenTile2.tile2TokenId as number,
  tokenTile2.tile3TokenId as number,
  tokenTile2.tile4TokenId as number,
  allMints) : this.getAnimationHtml(tokenTile2.tokenId, allMints) }
${ tokenTile3.isMosaic ? this.getMosaicAnimationHtml(
  tokenTile3.tokenId,
  tokenTile3.tile1TokenId as number,
  tokenTile3.tile2TokenId as number,
  tokenTile3.tile3TokenId as number,
  tokenTile3.tile4TokenId as number,
  allMints) : this.getAnimationHtml(tokenTile3.tokenId, allMints) }
${ tokenTile4.isMosaic ? this.getMosaicAnimationHtml(
  tokenTile4.tokenId,
  tokenTile4.tile1TokenId as number,
  tokenTile4.tile2TokenId as number,
  tokenTile4.tile3TokenId as number,
  tokenTile4.tile4TokenId as number,
  allMints) : this.getAnimationHtml(tokenTile4.tokenId, allMints) }
</div>`;
  }
}
