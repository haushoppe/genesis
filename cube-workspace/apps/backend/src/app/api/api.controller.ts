import { Controller, Get, Param } from '@nestjs/common';
import { NftCollection } from './moralis-openapi-types.dto';

const Moralis = require('moralis/node');

@Controller()
export class ApiController {

  /**
   * Just a test method
   */
  @Get(['api/test'])
  getTest() {
    return {
      hello: 'world'
    }
  }


  /**
   * Returns a list of all NFTs that the given address has
   */
  // http://localhost:3333/api/get-nfts-for-address/0x8c11C53F77aD5e91fB13611904f2F59b07Aa7c93
  @Get(['api/get-nfts-for-address/:address'])
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
}
