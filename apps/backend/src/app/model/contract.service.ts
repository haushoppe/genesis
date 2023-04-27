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
import { createFilledArray } from './contract.service.helper';

@Injectable()
export class ContractService  {

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
    Logger.log('ContractService initialized for ' + this.tokenName);
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
      events.map(async (e: EventLog) => await this.extractMintInfo(e)));
  }

  private async extractMintInfo(event: EventLog): Promise<MintInfo> {

    const mintInfo: MintInfo = {
      mintedBy: event.args[1],
      tokenId: parseInt(event.args[2]),
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber
    }

    // proprietary extra: IMosaic
    if (this.tokenConfig.implementsMosaics) {

      const isMosaic = await this.contract.isMosaic(mintInfo.tokenId)
      if (isMosaic) {
        mintInfo.isMosaic = true
        mintInfo.mosaics = (await this.contract.mosaics(mintInfo.tokenId)).map((x: string) => parseInt(x));
      }
    }

    return mintInfo;
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
      createFilledArray(totalSupply).map(async (tokenId: number) => await this.extractTokenOwner(tokenId)));

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

  private async extractTokenOwner(tokenId: number): Promise<TokenOwner> {

    const owner$: Promise<string> = this.contract.ownerOf(tokenId);
    const lender$: Promise<string> = (this.tokenConfig.implementsLendable) ? this.contract.tokenOwnersOnLoan(tokenId) : Promise.resolve(ZERO_ADDRESS);

    const [owner, lender] = await Promise.all([owner$, lender$]);

    const ownerName$ = this.lookupName(owner);
    const lenderName$ = (lender !== ZERO_ADDRESS) ? this.lookupName(lender) : Promise.resolve(null);

    const [ownerName, lenderName] = await Promise.all([ownerName$, lenderName$]);

    const tokenOwner: TokenOwner = {
      tokenId,
      owner,
      ownerName
    }

    if (lender !== ZERO_ADDRESS) {
      tokenOwner.lender = lender;
      tokenOwner.lenderName = lenderName;
    }


    return tokenOwner;
  }

  /**
   * Resolves to the ENS name associated for the address or null if the primary name is not configured.
   * (this response is shared/cached between all services)
  */
  private async lookupName(address: string | null) {

    if (!address) {
      return null;
    }

    return this.cacheService.loadCachedSync('name_' + address, async () => {

      try {
        const provider = this.getProvider();
        const name = await provider.lookupAddress(address);
        return name;

      } catch (ex) {
        Logger.warn('Catched Exception - ENS lookup for ' + address + '.\nException: ' +  ex.message);
      }
      return null;
    }, 60 * 60 * 12);
  }
}
