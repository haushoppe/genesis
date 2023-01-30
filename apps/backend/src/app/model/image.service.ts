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
    .composite([
      { input: allImages[0], gravity: 'northwest' },
      { input: allImages[1], gravity: 'northeast' },
      { input: allImages[2], gravity: 'southwest' },
      { input: allImages[3], gravity: 'southeast' },
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
}
