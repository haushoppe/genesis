import { Controller, Get, Param } from '@nestjs/common';

const Moralis = require('moralis/node');

class ShortNft {

}

@Controller()
export class ApiController {

  @Get(['api/test'])
  getTest() {
    return {
      hello: 'world'
    }
  }


  // http://localhost:3333/api/get-nfts-of-owner/0x8c11C53F77aD5e91fB13611904f2F59b07Aa7c93
  @Get(['api/get-nfts-of-owner/:address'])
  async getNftsOfOwner(@Param('address') address: string) {


    const options = { address };
    const nfts = await Moralis.Web3API.account.getNFTs(options);

    return {
      address,
      nfts
    }
  }
}
