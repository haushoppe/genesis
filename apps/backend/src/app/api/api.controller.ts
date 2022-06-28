import { Controller, Get, Param, Response, StreamableFile } from '@nestjs/common';
import { Response as Res } from 'express';
import { ApiParam, ApiProperty } from '@nestjs/swagger';
import axios from 'axios';

@Controller()
export class ApiController {

  /**
   * Super simple HTTP proxy to work around CORS issues
   */
  @Get(['api/proxy/:url'])
  @ApiParam({
    name: 'url',
    description: 'The full URL to request',
    example: 'https://cloudflare-ipfs.com/ipfs/QmYKabnBxtucct5Vkf81o9ZX6u2sCnZKU94VfGqUwzbZwg'
  })
  async getProxy(@Param('url') url: string, @Response({ passthrough: true }) res: Res): Promise<StreamableFile> {

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary')

    res.set({
      'content-type': response.headers['content-type'],
      'cache-control': 'public, max-age=29030400, immutable' // 4 weeks: 60 * 60 * 24 * 7 * 4 * 12 = 29030400
    });

    return new StreamableFile(buffer);
  }
}
