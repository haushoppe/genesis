import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, EventLog } from 'ethers';

import { knownAbis } from '../../../../shared/known-abis';
import { KnownTokenName } from '../../../../shared/known-token-name';
import { KnownTokenConfig } from '../config/known-token-config';
import { MintInfo } from '../types/mint-info';
import { TokenOwner } from '../types/token-owner';
import { CacheService } from './cache.service';
import { createFilledArray, extractMintInfo, extractSimpleTokenOwner, extractTokenOwner } from './contract.service.helper';
import { ZERO_ADDRESS } from './ethers-utils';

@Injectable()
export class ContractService {

  private readonly knownTokens = this.configService.get<KnownTokenConfig[]>('knownTokens');
  private readonly tokenConfig = this.knownTokens.find(x => x.name === this.tokenName);
  private readonly provider: ethers.Provider = this.getProvider();
  private readonly contract: ethers.Contract = this.getContract();

  private allMints: MintInfo[] = [];
  private allTokenOwners: TokenOwner[] = [];

  constructor(
    private configService: ConfigService,
    private tokenName: KnownTokenName,
    private cacheService: CacheService) {
  }

  /**
   * Performing async tasks before controllers are available
   */
  async onModuleInit() {
    if (this.tokenName != KnownTokenName.genesis) {
      return
    }

    await new Promise(resolve => setTimeout(resolve, 1));
    Logger.log('Initializing ContractService', this.tokenName);

    Logger.log('Contract Name: ' + await this.getContractName(), this.tokenName);
    Logger.log('Price: ' + ethers.formatEther(await this.getPrice()) + ' ETH', this.tokenName);

    if (this.tokenConfig.implementsMosaics) {
      Logger.log('Price for Mosaic: ' + ethers.formatEther(await this.getPriceForMosaic()) + ' ETH', this.tokenName);
    }

    this.allMints = await this.getAllCurrentMints();
    Logger.log('Amount of Mints: ' + this.allMints.length, this.tokenName);

    this.allTokenOwners = await this.getAllCurrentTokenOwners();
    Logger.log('Amount of Token Owner Records: ' + this.allTokenOwners.length, this.tokenName);

    Logger.log('Everything set up. Now watching for new transfers...', this.tokenName);
    this.listenForNewTransferEvents();
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

  private price?: string;
  async getPrice(): Promise<string> {
    return this.price || (this.price = (await this.contract.price()).toString());
  }

  private priceForMosaic?: string;
  async getPriceForMosaic(): Promise<string> {
    if (!this.tokenConfig.implementsMosaics) {
      return '-1';
    }
    return this.priceForMosaic || (this.priceForMosaic = (await this.contract.priceForMosaic()).toString());
  }

  async getTotalSupply(): Promise<number> {
    return parseInt(await this.contract.totalSupply());
  }

  /**
   * Retrieves all known mints
   */
  async getAllMints(): Promise<MintInfo[]> {
    return Promise.resolve(this.allMints)
  }

  /**
   * Retrieves all current mints by querying all token transfers from 0x0 to the new owner
   * This method is supposed to recreate the in-memory list of mints after a server restart
   */
  private async getAllCurrentMints(): Promise<MintInfo[]> {

    // List all token transfers *from* zero address!
    const filter = this.contract.filters.Transfer(ZERO_ADDRESS);
    const events = await this.contract.queryFilter(filter, this.tokenConfig.firstBlockNumber, 'latest');

    return await Promise.all(
      events.map(async (event: EventLog) => {

        const [from, to, tokenId_] = event.args;
        Logger.verbose(`Transfer: #${parseInt(tokenId_)} from ${from} to ${to}`, this.tokenName);

        return await extractMintInfo(
          event,
          this.tokenConfig.implementsMosaics,
          this.contract);
      })
    );
  }

  /**
   * Retrieves all token owners
   */
  async getAllTokenOwners(): Promise<TokenOwner[]> {
    return Promise.resolve(this.allTokenOwners)
  }

  /**
   * Loops through each token ID and get the owner's address + lender address
   * This method is supposed to recreate the in-memory list of mints after a server restart
   * It does not uses token transfers to build the list, because there might be a huge amout of past transfers
   *
   * WARNING: this code only works if the first token starts with number 0!
   */
  private async getAllCurrentTokenOwners(): Promise<TokenOwner[]> {

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
  }

  /**
   * Listens for new Transfer events from the contract and updates the state accordingly.
   * This method should be called once to start listening for events.
   * Handles new mint events, normal token transfers, and checks for duplicated events.
   *
   * Hint: duplicated events could be related to this:
   * https://github.com/ethers-io/ethers.js/issues/4013
   */
  private async listenForNewTransferEvents() {

    // waiting for this to get released!
    // Did the 'error' event listener get removed in v6, like provider.on('error', () => {})? #3970
    //
    // https://github.com/ethers-io/ethers.js/issues/3970
    // https://github.com/ethers-io/ethers.js/commit/af0291c01639674658f5049343da88a84da763a1
    // this.provider.on('error', (event) => {
    //   console.log(event)
    // })

    const filter = this.contract.filters.Transfer(null, null, null);
    this.contract.on(filter, async (event: EventLog) => {

      const [from, to, tokenId_] = event.args;
      const tokenId = parseInt(tokenId_);
      Logger.verbose(`Transfer: #${tokenId} from ${from} to ${to}`, this.tokenName);

      // new mint
      if (from == ZERO_ADDRESS) {

        if (this.allMints.find(m => m.tokenId === tokenId)) {
          Logger.verbose(`Duplicated mint event detected! Skipping.`);
        } else {

          const mint = await extractMintInfo(
            event,
            this.tokenConfig.implementsMosaics,
            this.contract);

          this.allMints = [...this.allMints, mint];
        }

        // normal token transfer
      } else {

        const oldTokenOwner = this.allTokenOwners.find(t => t.tokenId === tokenId);
        if (!oldTokenOwner) {
          throw new Error(`Non-consistent state detected. There is no token owner record for the token #${tokenId} for collection #${this.tokenName}!`);
        }

        if (oldTokenOwner.owner === to) {
          Logger.verbose(`Duplicated transfer event detected! Skipping.`);
        } else {

          const newTokenOwner = await extractSimpleTokenOwner(
            tokenId,
            to,
            this.tokenConfig.implementsLendable,
            this.lookupName.bind(this),
            this.contract
          )
          this.allTokenOwners = this.allTokenOwners.map(t => t.tokenId === tokenId ? newTokenOwner : t);
        }
      }
    });
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
        // ENS does not enforce the accuracy of reverse records
        // - for instance, anyone may claim that the name for their address is 'alice.eth'.
        // To be certain that the claim is accurate, you must always perform a forward resolution
        // for the returned name and check it matches the original address.
        // --> ethers.js automatically checks that the forward resolution matches!
        // (and returns null in that case)
        const name = await provider.lookupAddress(address);
        return name;

      } catch (ex) {
        Logger.warn('Catched Exception - ENS lookup for ' + address + '.\nException: ' + ex.message);
      }
      return null;
    }, 60 * 60 * 12);
  }
}
