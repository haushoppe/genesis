import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventLog, ethers } from 'ethers';

import { KnownTokenConfig } from '../config/known-token-config';
import { KnownTokenName } from '../../../../shared/known-token-name';
import { MintInfo } from '../types/mint-info';
import { ZERO_ADDRESS } from './ethers-utils';
import { knownAbis } from '../../../../shared/known-abis';
import { TokenOwner } from '../types/token-owner';
import { CacheService } from './cache.service';
import { lookup } from 'dns';


@Injectable()
export class ContractService {

  private knownTokens = this.configService.get<KnownTokenConfig[]>('knownTokens');

  constructor(
    private configService: ConfigService,
    private tokenName: KnownTokenName,
    private cacheService: CacheService) { }

  getProvider() {

    const tokenConfig = this.knownTokens.find(x => x.name === this.tokenName);
    const network = tokenConfig.networkName;
    let provider: ethers.Provider;

    if (network === 'hardhat') {

      // Ethers connects to the default `http://localhost:8545`
      provider = new ethers.JsonRpcProvider();

    } else {
      const apiKey = this.configService.get<string>('alchemyKey_' + network);

      // const provider = new ethers.providers.FallbackProvider([
      //   new ethers.providers.AlchemyProvider(NETWORK_NAME, ALCHEMY_KEY),
      //   new ethers.providers.InfuraProvider(NETWORK_NAME, INFURA_KEY),
      // ]);

      provider = new ethers.AlchemyProvider(network, apiKey);
    }

    return provider;
  }

  getContract() {

    const tokenConfig = this.knownTokens.find(x => x.name === this.tokenName);
    const abi = knownAbis[this.tokenName];
    const provider = this.getProvider();

    const contract = new ethers.Contract(tokenConfig.contractAddress, abi, provider);
    return contract;
  }

  async getContractName(): Promise<string> {

    const contract = this.getContract();
    return await contract.name();
  }

  async getTotalSupply(): Promise<number> {

    const contract = this.getContract();
    return parseInt(await contract.totalSupply());
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

    /* EXAMPLE (ethers v6 with support for BigInt)

    EventLog {
      provider: JsonRpcProvider {},
      transactionHash: '0xf245bc6b75cce5a45a4743aeac632c9c244e535091f7bbf50bdb1d27620c5fc9',
      blockHash: '0xf26787235b4356a823aa835493594bcae1758bff11083d023a1c0df57ba64f64',
      blockNumber: 10,
      removed: false,
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      data: '0x',
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266',
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      ],
      index: 0,
      transactionIndex: 0,
      interface: Interface {
        fragments: [Array],
        deploy: [ConstructorFragment],
        fallback: null,
        receive: false
      },
      fragment: EventFragment {
        type: 'event',
        inputs: [Array],
        name: 'Transfer',
        anonymous: false
      },
      args: Result(3) [
        '0x0000000000000000000000000000000000000000',
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        0n
      ]
    }
    */
    const events = await contract.queryFilter(filter, tokenConfig.firstBlockNumber, 'latest');

    // console.log(events);

    let allMints: MintInfo[] = events.map((event: EventLog) => ({
      mintedBy: event.args[1],
      tokenId: parseInt(event.args[2]),
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
        mosaics: mint.isMosaic ? (await contract.mosaics(mint.tokenId)).map(x => parseInt(x)) : []
      })));
    }

    return allMints;
  }

  async getAllTokenOwners(): Promise<TokenOwner[]> {

    const contract = this.getContract();

    const totalSupply = parseInt(await contract.totalSupply());


    // Loop through each token ID and get the owner's address
    const tokenOwners: TokenOwner[] = [];
    for (let tokenId = 0; tokenId < totalSupply; tokenId++) {

      const owner = await contract.ownerOf(tokenId);

      let lender = await contract.tokenOwnersOnLoan(tokenId);
      if (lender === ZERO_ADDRESS) {
        lender = undefined;
      }

      tokenOwners.push({
        tokenId,
        owner,
        ownerDomain: await this.lookupAddress(owner),
        lender,
        lenderDomain: await this.lookupAddress(lender)
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
        ownerDomain: await this.lookupAddress(to),
        lender,
        lenderDomain: await this.lookupAddress(lender)
      };
    });

    return tokenOwners;
  }

  async lookupAddress(address: string | null) {


    if (!address) {
      return null;
    }

    console.log('ENS lookup: ' +  address)

    return this.cacheService.loadCachedSync('domain_' + address, undefined, () => {

      const provider = this.getProvider();
      const domain = provider.lookupAddress(address);
      return domain;
    });
  }
}
