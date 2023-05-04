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
import { createFilledArray, extractMintInfo, extractTokenOwner } from './contract.service.helper';

@Injectable()
export class ContractService {

  private readonly knownTokens = this.configService.get<KnownTokenConfig[]>('knownTokens');
  private readonly tokenConfig = this.knownTokens.find(x => x.name === this.tokenName);
  private readonly provider: ethers.Provider = this.getProvider();
  private readonly contract: ethers.Contract = this.getContract();

  constructor(
    private configService: ConfigService,
    private tokenName: KnownTokenName,
    private cacheService: CacheService) {
  }

  /**
   * Performing async tasks before controllers are available
   */
  async onModuleInit() {
    await new Promise(resolve => setTimeout(resolve, 1));
    Logger.log('Initializing ContractService', this.tokenName);

    Logger.log('Contract Name: ' + await this.getContractName(), this.tokenName);
    Logger.log('Price: ' + ethers.formatEther(await this.getPrice()) + ' ETH', this.tokenName);

    if (this.tokenConfig.implementsMosaics) {
      Logger.log('Price for Mosaic: ' + ethers.formatEther(await this.getPriceForMosaic()) + ' ETH', this.tokenName);
    }

    await this.getAllCurrentMints();
    await this.getAllCurrentTokenOwners();

  }

  private getProvider() {

    const network = this.tokenConfig.networkName;
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

  private getContract() {

    const tokenConfig = this.knownTokens.find(x => x.name === this.tokenName);
    const abi = knownAbis[this.tokenName];

    const contract = new ethers.Contract(tokenConfig.contractAddress, abi, this.provider);
    return contract;
  }

  private _contractName?: string;
  async getContractName(): Promise<string> {
    return this._contractName || (this._contractName = await this.contract.name());
  }

  private _price?: string;
  async getPrice(): Promise<string> {
    return this._price || (this._price = (await this.contract.price()).toString());
  }

  private _priceForMosaic?: string;
  async getPriceForMosaic(): Promise<string> {
    if (!this.tokenConfig.implementsMosaics) {
      return '-1';
    }
    return this._priceForMosaic || (this._priceForMosaic = (await this.contract.priceForMosaic()).toString());
  }

  async getTotalSupply(): Promise<number> {
    return parseInt(await this.contract.totalSupply());
  }


  /**
   * Retrieves all current mints by querying all token transfers from 0x0 to the new owner
   * This method is supposed to recreate the in-memory list of mints after a server restart
   */
  async getAllCurrentMints(): Promise<MintInfo[]> {

    // List all token transfers *from* zero address!
    const filter = this.contract.filters.Transfer(ZERO_ADDRESS);
    const events = await this.contract.queryFilter(filter, this.tokenConfig.firstBlockNumber, 'latest');

    return await Promise.all(
      events.map(async (event: EventLog) => await extractMintInfo(
        event,
        this.tokenConfig.implementsMosaics,
        this.contract)
      )
    );
  }



  /**
   * Loops through each token ID and get the owner's address + lender address
   * This method is supposed to recreate the in-memory list of mints after a server restart
   * It does not uses token transfers to build the list, because there might be a huge amout of past transfers
   *
   * WARNING: this code only works if the first token starts with number 0!
   */
  async getAllCurrentTokenOwners(): Promise<TokenOwner[]> {

    const totalSupply = parseInt(await this.contract.totalSupply());

    return await Promise.all(
      createFilledArray(totalSupply).map(async (tokenId: number) => await extractTokenOwner(
        tokenId,
        this.tokenConfig.implementsLendable,
        this.lookupName.bind(this),
        this.contract
        )
      )
    );

    /*

    this.contract.on('Transfer', async (from: string, to: string, tokenId: number) => {
      Logger.verbose(`NFT token ID ${tokenId} transferred from ${from} to ${to}`);

      let lender = await this.contract.tokenOwnersOnLoan(tokenId);
      if (lender === ZERO_ADDRESS) {
        lender = undefined
      }

      // Update the owners object
      tokenOwners[tokenId] = {
        tokenId,
        owner: to,
        ownerName: await this.lookupName(to),
        lender,
        lenderName: await this.lookupName(lender)
      };
    });

    return tokenOwners;*/
  }



  /**
   * Resolves to the ENS name associated for the address or null if the primary name is not configured.
   * (this response is shared/cached between all services)
  */
  private async lookupName(address: string | null): Promise<string> {

    if (!address) {
      return null;
    }

    return this.cacheService.loadCachedSync('name_' + address, async () => {

      try {
        const provider = this.getProvider();
        const name = await provider.lookupAddress(address);
        return name;

      } catch (ex) {
        Logger.warn('Catched Exception - ENS lookup for ' + address + '.\nException: ' + ex.message);
      }
      return null;
    }, 60 * 60 * 12);
  }
}
