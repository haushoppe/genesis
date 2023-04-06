import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

import { KnownTokenConfig } from '../config/known-token-config';
import { KnownTokenName } from '../../../../shared/known-token-name';
import { MintInfo } from '../types/mint-info';
import { CacheService } from './cache.service';
import { ZERO_ADDRESS } from './ethers-utils';
import { knownAbis } from '../../../../shared/known-abis';

const ttl = 60 * 5; // 5 minutes

@Injectable()
export class ContractService {

  private knownTokens = this.configService.get<KnownTokenConfig[]>('knownTokens');

  constructor(private configService: ConfigService, private cacheService: CacheService) { }

  getContract(tokenName: string) {

    const tokenConfig = this.knownTokens.find(x => x.name === tokenName);
    const abi = knownAbis[tokenName];
    const network = tokenConfig.networkName;
    let provider: ethers.providers.Provider;

    if (network === 'hardhat') {

      // Ethers connects to the default `http://localhost:8545`
      provider = new ethers.providers.JsonRpcProvider();

    } else {
      const apiKey = this.configService.get<string>('alchemyKey_' + network);

      // const provider = new ethers.providers.FallbackProvider([
      //   new ethers.providers.AlchemyProvider(NETWORK_NAME, ALCHEMY_KEY),
      //   new ethers.providers.InfuraProvider(NETWORK_NAME, INFURA_KEY),
      // ]);

      provider = new ethers.providers.AlchemyProvider(network, apiKey);
    }

    const contract = new ethers.Contract(tokenConfig.contractAddress, abi, provider);
    return contract;
  }

  async getContractName(tokenName: KnownTokenName): Promise<string> {
    return await this.cacheService.loadCached('contractName_' + tokenName, ttl, async () => {

      const contract = this.getContract(tokenName);
      return await contract.name();
    });
  }

  async getTotalSupply(tokenName: KnownTokenName): Promise<number> {
    return await this.cacheService.loadCached('totalSupply_' + tokenName, ttl, async () => {

      const contract = this.getContract(tokenName);
      return (await contract.totalSupply()).toNumber();
    });
  }

  async getPrice(tokenName: KnownTokenName): Promise<string> {
    return await this.cacheService.loadCached('price_' + tokenName, ttl, async () => {

      const contract = this.getContract(tokenName);
      return (await contract.price()).toString();
    });
  }

  async getPriceForMosaic(tokenName: KnownTokenName): Promise<string> {
    return await this.cacheService.loadCached('priceForMosaic_' + tokenName, ttl, async () => {

      const contract = this.getContract(tokenName);
      return (await contract.priceForMosaic()).toString();
    });
  }

  async getAllMints(tokenName: KnownTokenName): Promise<MintInfo[]> {
    return await this.cacheService.loadCached('allMints_' + tokenName, ttl, async () => {

      const tokenConfig = this.knownTokens.find(x => x.name === tokenName);
      const contract = this.getContract(tokenName);

      // List all token transfers *from* zero address (this is how a lint looks like)
      const filter = contract.filters.Transfer(ZERO_ADDRESS);

      /* EXAMPLE
      [
        {
          "blockNumber": 16314192,
          "blockHash": "0x564a59420b079ab4fdcf64ee00a897b761cdc336205c780ad27ee2aa34874d09",
          "transactionIndex": 102,
          "removed": false,
          "address": "0xBF79e5797dd766288F7831689EF943b286f92d86",
          "data": "0x",
          "topics": [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x00000000000000000000000033cf8688b6afc84ea4f1f9464f000ba9b02be356",
            "0x0000000000000000000000000000000000000000000000000000000000000000"
          ],
          "transactionHash": "0xecc1d6e5af231e357160ba7a527b7b1c6bd8ff57f3da6462292b908b3395beaa",
          "logIndex": 207,
          "event": "Transfer",
          "eventSignature": "Transfer(address,address,uint256)",
          "args": [
            "0x0000000000000000000000000000000000000000",
            "0x33CF8688b6aFC84ea4F1F9464f000bA9B02Be356",
            {
              "type": "BigNumber",
              "hex": "0x00"
            }
          ]
        }
      ]
      */
      const events = await contract.queryFilter(filter, tokenConfig.firstBlockNumber, 'latest');

      let allMints: MintInfo[] = events.map(event => ({
        mintedBy: event.args[1],
        tokenId: event.args[2].toNumber(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      }));

      if (tokenConfig.implementsMosaics) {
        allMints = await Promise.all(allMints.map(async mint => ({
          ...mint,
          isMosaic: await contract.isMosaic(mint.tokenId)
        })));

        allMints = await Promise.all(allMints.map(async mint => ({
          ...mint,
          mosaics: mint.isMosaic ? (await contract.mosaics(mint.tokenId)).map(x => x.toNumber()) : []
        })));
      }

      return allMints;
    });
  }

  // We want to know which token belongs to whom.
  // Problem: there could be a huge amount of transfers over time and this could lead to RPC rate limits
  // Current Solution: We expect a relatively small number of tokens. Therefore, all we need to do is to iterate through all the token ids and see who they belong to right now.
  async getAllTokenOwners(tokenName: KnownTokenName) {

    const cacheKey = 'allTokenOwners_' + tokenName;
    if (this.cacheService.has(cacheKey)) {
      return this.cacheService.get<any[]>(cacheKey);
    }

    // TODO
    const allTokenOwerns: any[] = [];

    return this.cacheService.set(cacheKey, allTokenOwerns, ttl);

  }
}
