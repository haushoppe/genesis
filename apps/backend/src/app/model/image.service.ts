import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp = require('sharp')
import { Metadata } from '../types/metadata';
import axios from 'axios';


// Docs:
// https://www.npmjs.com/package/sharp

@Injectable()
export class ImageService {

  private cachedImages: { [tokenNameAndTokenId: string]: Buffer } = {};

  constructor(private configService: ConfigService) { }

  async getMosiacPreview(tokenName: string, tokenId: number, mosaic: Metadata): Promise<Buffer> {

    const cacheKey = tokenName + '-' + tokenId;

    let image = this.cachedImages[cacheKey];
    if (image) {
      return image;
    }

    const allImages = await Promise.all([
      this.getThumbnail(mosaic.tile1Image as string),
      this.getThumbnail(mosaic.tile2Image as string),
      this.getThumbnail(mosaic.tile3Image as string),
      this.getThumbnail(mosaic.tile4Image as string),
    ]);

    // Create a blank 400x400 PNG image with transparent background
    image = await sharp({
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

    this.cachedImages[cacheKey] = image;
    return image;
  }

  async getThumbnail(imagUrl: string) {

    const response = await axios.get(imagUrl, { responseType: 'arraybuffer' })
    const buffer = Buffer.from(response.data);
    return await sharp(buffer).resize({ width: 200, height: 200 }).toBuffer();
  }


}
