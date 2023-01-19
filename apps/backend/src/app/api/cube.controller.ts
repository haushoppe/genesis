import { Controller, Get, Logger, Param, Response, StreamableFile } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiParam, ApiTags } from '@nestjs/swagger';
import axios from 'axios';
import { Response as Res } from 'express';


@ApiTags('cube')
@Controller()
export class CubeController {

  /**
   * HTTP proxy to avoid CORS issues
   * (hidden from Open Api but can be called on production)
   */
  @Get(['cube/proxy/:url'])
  @ApiParam({
    name: 'url',
    description: 'The full URL to request',
    example: 'https://cloudflare-ipfs.com/ipfs/QmYKabnBxtucct5Vkf81o9ZX6u2sCnZKU94VfGqUwzbZwg'
  })
  @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
  async getProxy(@Param('url') url: string, @Response({ passthrough: true }) res: Res): Promise<StreamableFile> {

    // Logger.verbose("Serving api/proxy/" + url);

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary')

    res.set({
      'content-type': response.headers['content-type'],
      'cache-control': 'public, max-age=29030400, immutable' // 4 weeks: 60 * 60 * 24 * 7 * 4 * 12 = 29030400
    });

    return new StreamableFile(buffer);
  }
}
