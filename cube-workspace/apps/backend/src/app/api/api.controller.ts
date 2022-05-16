import { Controller, Get, Param, Response, StreamableFile } from '@nestjs/common';
import { Response as Res } from 'express';
import { ApiParam, ApiProperty } from '@nestjs/swagger';
import axios from 'axios';
import { NftCollection } from './moralis-openapi-types.dto';

const Moralis = require('moralis/node');

@Controller()
export class ApiController {

  /**
   * Returns a list of all NFTs that the given address has
   */
  @Get(['api/get-nfts-for-address/:address'])
  @ApiParam({
    name: 'address',
    description: 'The ethereum wallet to check',
    example: '0x8c11C53F77aD5e91fB13611904f2F59b07Aa7c93'
  })
  async getNftsForAddress(@Param('address') address: string): Promise<NftCollection> {

    const options = { address };
    const nfts: NftCollection = await Moralis.Web3API.account.getNFTs(options);

    // remove all unnecessary other properties
    nfts.result = nfts.result.map(({
      token_address,
      token_id,
      contract_type,
      token_uri,
      metadata,
      synced_at,
      amount,
      name,
      symbol
    }) => ({
      token_address,
      token_id,
      contract_type,
      token_uri,
      metadata: metadata ? JSON.parse(metadata) : undefined,
      synced_at,
      amount,
      name,
      symbol
    }));

    return nfts;
  }

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
      // 'content-disposition': 'attachment; filename="cube.jpg"',
    });

    return new StreamableFile(buffer);
  }
}
