import { Controller, Get, Param } from '@nestjs/common';
import { NftCollection } from './moralis-openapi-types.dto';

const Moralis = require('moralis/node');

@Controller()
export class ApiController {

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
    const nftsRaw: NftCollection = await Moralis.Web3API.account.getNFTs(options);

    console.log(typeof nftsRaw);

    // // remove all unnecessary other properties
    // const nfts = nftsRaw.map(({
    //   amount,
    //   contract_type,
    //   name,
    //   symbol,
    //   token_address,
    //   token_id,
    //   token_uri,
    //   metadata
    // }) => ({
    //   amount,
    //   contract_type,
    //   name,
    //   symbol,
    //   token_address,
    //   token_id,
    //   token_uri,
    //   metadata
    // }));

    return nftsRaw;
  }
}
