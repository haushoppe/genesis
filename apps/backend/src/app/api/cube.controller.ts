import { Controller, Get, Header, Param, Response, StreamableFile } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import axios from 'axios';
import { Response as Res } from 'express';

import { oneWeekInSeconds } from '../types/constants';


@ApiTags('cube')
@Controller()
export class CubeController {

  /**
   * HTTP proxy to avoid CORS issues
   * (hidden from Open Api but can be called on production)
   */
  @Get(['cube/proxy/:url'])
  @ApiOperation({ operationId: 'proxy' })
  @ApiParam({
    name: 'url',
    description: 'The full URL to request',
    example: 'https://cloudflare-ipfs.com/ipfs/QmYKabnBxtucct5Vkf81o9ZX6u2sCnZKU94VfGqUwzbZwg'
  })
  @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
  @Header('Cache-Control', 'public, max-age=' + oneWeekInSeconds + ', immutable')
  async getProxy(@Param('url') url: string, @Response({ passthrough: true }) res: Res): Promise<StreamableFile> {

    // Logger.verbose("Serving api/proxy/" + url);

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary')

    res.set({
      'Content-Type': response.headers['content-type'],
    });

    return new StreamableFile(buffer);
  }
}
