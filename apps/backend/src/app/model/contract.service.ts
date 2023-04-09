import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

import { KnownTokenConfig } from '../config/known-token-config';
import { KnownTokenName } from '../../../../shared/known-token-name';
import { MintInfo } from '../types/mint-info';
import { ZERO_ADDRESS } from './ethers-utils';
import { knownAbis } from '../../../../shared/known-abis';
import { TokenOwner } from '../types/token-owner';


@Injectable()
export class ContractService {

  private knownTokens = this.configService.get<KnownTokenConfig[]>('knownTokens');

  constructor(private configService: ConfigService, private tokenName: KnownTokenName) { }

  getContract() {

    const tokenConfig = this.knownTokens.find(x => x.name === this.tokenName);
    const abi = knownAbis[this.tokenName];
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

  async getContractName(): Promise<string> {

    const contract = this.getContract();
    return await contract.name();
  }

  async getTotalSupply(): Promise<number> {

    const contract = this.getContract();
    return (await contract.totalSupply()).toNumber();
  }

  async getPrice(): Promise<string> {

    const contract = this.getContract();
    return (await contract.price()).toString();
  }

  async getPriceForMosaic(): Promise<string> {

    const contract = this.getContract();
    return (await contract.priceForMosaic()).toString();
  }

  async getAllMints(): Promise<MintInfo[]> {

    const tokenConfig = this.knownTokens.find(x => x.name === this.tokenName);
    const contract = this.getContract();

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
  }

  async getAllTokenOwners(): Promise<TokenOwner[]> {

    const contract = this.getContract();

    const totalSupply = (await contract.totalSupply()).toNumber();


    // Loop through each token ID and get the owner's address
    const tokenOwners: TokenOwner[] = [];
    for (let tokenId = 0; tokenId < totalSupply; tokenId++) {

      const owner = await contract.ownerOf(tokenId);
      let lender = await contract.tokenOwnersOnLoan(tokenId);
      if (lender === ZERO_ADDRESS) {
        lender = undefined
      }

      tokenOwners.push({
        tokenId,
        owner,
        lender
      });
    }

    contract.on('Transfer', async (from: string, to: string, tokenId: number) => {
      Logger.verbose(`NFT token ID ${tokenId} transferred from ${from} to ${to}`);

      let lender = await contract.tokenOwnersOnLoan(tokenId);
      if (lender === ZERO_ADDRESS) {
        lender = undefined
      }

      // Update the owners object
      tokenOwners[tokenId] = {
        tokenId,
        owner: to,
        lender
      };
    });

    return tokenOwners;
  }
}
