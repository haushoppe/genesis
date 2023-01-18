import { Body, Controller, ForbiddenException, Get, Logger, NotFoundException, NotImplementedException, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { createRawGenesisMetadata, createGenesisMosaicMetadata, genesisArtworks, createFallbackImage } from '../../assets/data/tokendata_genesis';

import { AllowlistService } from '../model/allowlist.service';
import { ContractService } from '../model/contract.service';
import { formatSeconds } from '../model/date-utils';
import { encodePackedMessage, getSigner, hashMessage, signMessage } from '../model/ethers-utils';
import { MetadataService } from '../model/metadata.service';
import { KnownTokenConfig } from '../types/known-token-config';
import { KnownTokenName } from '../types/known-token-name';
import { Metadata } from '../types/metadata';
import { MintRequest } from '../types/mint-request';
import { MintTicket } from '../types/mint-ticket';


@ApiTags('api')
@Controller()
export class ApiController {

  private knownTokens = this.configService.get<KnownTokenConfig[]>('knownTokens');

  constructor(
    private configService: ConfigService,
    private allowlistService: AllowlistService,
    private contractService: ContractService,
    private metadataService: MetadataService) { }

  /**
   * Minting via allowlist
   *
   * Allow for minting of tokens up to the maximum allowed for a given address.
   * The address of the sender and the number of mints allowed are hashed and signed
   * with the server's private key and verified on-chain to prove allowlist status.
   */
  @Post(['api/mintAllowlist'])
  @ApiNotFoundResponse({ description: 'Unkown token name' })
  @ApiForbiddenResponse({ description: 'The sender is not on the allowlist' })
  @ApiOkResponse({
    description: 'The required params to execute the mint',
    type: MintTicket
  })
  async mintAllowlist(@Body() mintRequest: MintRequest): Promise<MintTicket> {

    const tokenName = mintRequest.tokenName;
    const sender = mintRequest.sender.toLowerCase();

    Logger.verbose(`Mint request for token ${tokenName} from sender ${sender}`);

    if (!this.knownTokens.map(x => x.name).includes(tokenName)) {
      throw new NotFoundException('Unknown token name');
    }

    if (sender === '0x0000000000000000000000000000000000000000') {
      throw new ForbiddenException('The zero address is not a valid sender');
    }

    const mintWallets = this.allowlistService.getMintWallets(tokenName);
    if (!mintWallets.includes(sender)) {
      throw new ForbiddenException('The sender is not on the allowlist');
    }

    const privateKey = this.configService.get('signerKey_' + tokenName);
    const signer = getSigner(privateKey);
    const maximumAllowedMints = 4;

    const message = encodePackedMessage(sender, maximumAllowedMints);
    const messageHash = hashMessage(message);
    const signature = await signMessage(signer, messageHash);

    return {
      messageHash,
      signature,
      maximumAllowedMints
    };
  }

  /**
   * Status of this service
   */
  @ApiParam({
    name: 'tokenName',
    description: 'Limits the contract details to one token',
    enum: ['all', ...Object.keys(KnownTokenName)],
    example: KnownTokenName.genesis,
  })
  @Get(['api/status/:tokenName'])
  async getStatus(@Param('tokenName') tokenName: 'all' | KnownTokenName) {

    let knownTokens = this.knownTokens;

    if (tokenName !== 'all') {
      knownTokens = [knownTokens.find(x => x.name === tokenName)];
    }

    return {
      environment: this.configService.get('environment'),
      uptime: formatSeconds(process.uptime()),
      network: this.configService.get('network'),
      knownTokens: await Promise.all(knownTokens.map(async token => ({
        name: token.name,
        address: token.address,
        etherscanLink: (this.configService.get('network') === 'goerli' ?
          'https://goerli.etherscan.io/address/' :
          'https://etherscan.io/address/') + token.address,
        signer: getSigner(this.configService.get('signerKey_' + token.name)).address,
        maximumAllowedMintsPerAddress: token.maximumAllowedMintsPerAddress,
        allowlistEntries: this.allowlistService.getMintWallets(token.name).length,
        contractName: (await this.contractService.getName(token.name)),
        totalSupply: (await this.contractService.getTotalSupply(token.name))
      })))
    };
  }

  @ApiParam({
    name: 'tokenName',
    enum: KnownTokenName,
    example: KnownTokenName.genesis,
  })
  @Get(['api/debugMints/:tokenName'])
  @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
  async debugMints(@Param('tokenName') tokenName: KnownTokenName) {

    if (this.configService.get('environment') !== 'development') {
      throw new ForbiddenException('This method should not be called on production');
    }

    return await this.contractService.getAllMints(tokenName);
  }

  @ApiParam({
    name: 'tokenName',
    enum: KnownTokenName,
    example: KnownTokenName.genesis,
  })
  @Get(['api/debugRawMetadata/:tokenName'])
  @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
  debugRawMetadata(@Param('tokenName') tokenName: KnownTokenName) {

    if (this.configService.get('environment') !== 'development') {
      throw new ForbiddenException('This method should not be called on production');
    }

    let rawMetadata: Metadata[];

    if (tokenName === KnownTokenName.genesis) {
      rawMetadata = createRawGenesisMetadata(genesisArtworks);
      return {
        amountOfTokens: rawMetadata.length,
        metadata: rawMetadata
      }
    }

    throw new NotImplementedException('This token is not ready yet!');
  }

  @ApiParam({
    name: 'tokenName',
    enum: KnownTokenName,
    example: KnownTokenName.genesis,
  })
  @Get(['api/allMetadata/:tokenName'])
  async metadata(@Param('tokenName') tokenName: KnownTokenName) {

    const allMints = await this.contractService.getAllMints(tokenName);

    let rawMetadata: Metadata[];

    if (tokenName === KnownTokenName.genesis) {
      rawMetadata = createRawGenesisMetadata(genesisArtworks);
      return this.metadataService.generateMetadata(
        allMints,
        rawMetadata,
        createGenesisMosaicMetadata,
        createFallbackImage);
    }

    throw new NotImplementedException('This token is not ready yet!');
  }

}
