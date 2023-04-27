import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Logger,
  NotFoundException,
  NotImplementedException,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import * as express from 'express';

import { KnownTokenName } from '../../../../shared/known-token-name';
import { KnownChains } from '../config/known-chains';
import { KnownTokenConfig } from '../config/known-token-config';
import { AllowlistService } from '../model/allowlist.service';
import { ContractService } from '../model/contract.service';
import { formatSeconds } from '../model/date-utils';
import { encodePackedMessage, getSigner, hashMessage, signMessage } from '../model/ethers-utils';
import { ImageService } from '../model/image.service';
import { MetadataGenesisService } from '../model/metadata-genesis.service';
import { ConfigResponse } from '../types/config-response';
import { oneWeekInSeconds, tenMinutesInSeconds } from '../types/constants';
import { Metadata } from '../types/metadata';
import { MintInfo } from '../types/mint-info';
import { MintRequest } from '../types/mint-request';
import { MintTicket } from '../types/mint-ticket';
import { TokenOwner } from '../types/token-owner';
import { CacheService } from '../model/cache.service';
import { ModuleRef } from '@nestjs/core';


@ApiTags('api')
@Controller()
export class ApiController {

  private knownTokens = this.configService.get<KnownTokenConfig[]>('knownTokens');
  // private contractServices = { } as { [tokenName in KnownTokenName.genesis]: ContractService };

  constructor(
    private configService: ConfigService,
    private allowlistService: AllowlistService,
    private metadataGenesisService: MetadataGenesisService,
    private imageService: ImageService,
    private moduleRef: ModuleRef) {

      // for (const tokenName in KnownTokenName) {
      //   this.contractServices[tokenName] = new ContractService(
      //     configService,
      //     tokenName as KnownTokenName,
      //     this.cacheService);
      // }
  }

  /**
   * Minting via allowlist, or limited mint.
   *
   * Allow for minting of tokens up to the maximum allowed for a given address.
   * The address of the sender and the number of mints allowed are hashed and signed
   * with the server's private key and verified on-chain to prove allowlist status.
   */
  @Post(['api/mintTicket'])
  @ApiOperation({ operationId: 'mintTicket' })
  @ApiNotFoundResponse({ description: 'Unkown token name' })
  @ApiForbiddenResponse({ description: 'The zero address is not a valid sender' })
  @ApiOkResponse({
    description: 'The required params to execute the mint',
    type: MintTicket
  })
  async mintTicket(@Body() mintRequest: MintRequest): Promise<MintTicket> {

    const tokenName = mintRequest.tokenName;
    const sender = mintRequest.sender.toLowerCase();

    Logger.verbose(`Mint ticked requested for token ${tokenName} by sender ${sender}`);

    if (!this.knownTokens.map(x => x.name).includes(tokenName)) {
      throw new NotFoundException('Unknown token name');
    }

    if (sender === '0x0000000000000000000000000000000000000000') {
      throw new ForbiddenException('The zero address is not a valid sender');
    }

    const mintWallets = this.allowlistService.getMintWallets(tokenName);

    // there is an allowlist and the sender is not included
    if (mintWallets.length > 0 && !mintWallets.includes(sender)) {
      return {
        messageHash: null,
        signature: null,
        maximumAllowedMints: 0
      };
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
   * Determines which blockchain network the frontend should connect to,
   * and provides other helpful data that the backend has already collected
   */
  @Get(['api/config/:tokenName'])
  @ApiOperation({ operationId: 'config' })
  @ApiParam({
    name: 'tokenName',
    description: 'Limits the contract details to one token',
    enum: KnownTokenName,
    example: KnownTokenName.genesis,
  })
  @ApiResponse({ type: ConfigResponse, isArray: true })
  @Header('Cache-Control', 'no-cache')
  async config(@Param('tokenName') tokenName: KnownTokenName): Promise<ConfigResponse> {

    if (!this.knownTokens.map(x => x.name).includes(tokenName)) {
      throw new NotFoundException('Unknown token name');
    }

    const contractService = this.moduleRef.get<ContractService>(tokenName);

    const token = this.knownTokens.find(x => x.name === tokenName);

    return {
      environment: this.configService.get('environment'),
      uptime: formatSeconds(process.uptime()),
      config: {
        name: token.name,
        maximumAllowedMintsPerAddress: token.maximumAllowedMintsPerAddress,
        contractAddress: token.contractAddress,
        networkName: token.networkName,
        networkConfig: {
          ...KnownChains[token.networkName],
          rpcUrl: KnownChains[token.networkName].rpcUrl.replace('API_KEY', this.configService.get<string>('alchemyKey_' + token.networkName))
        },
        firstBlockNumber: token.firstBlockNumber,
        implementsMosaics: token.implementsMosaics,
        explorerLink: KnownChains[token.networkName].blockExplorerUrl + '/address/' + token.contractAddress,
        signer: getSigner(this.configService.get('signerKey_' + token.name)).address,
        allowlistEntries: this.allowlistService.getMintWallets(token.name).length,

        contractName: (await contractService.getContractName()),
        totalSupply: (await contractService.getTotalSupply()),
        price: (await contractService.getPrice()),
        priceForMosaic: token.implementsMosaics ? (await contractService.getPriceForMosaic()) : '-1',
      }
    };
  }

  @Get(['api/debugAllMints/:tokenName'])
  @ApiOperation({ operationId: 'debugAllMints' })
  @ApiParam({
    name: 'tokenName',
    enum: KnownTokenName,
    example: KnownTokenName.genesis,
  })
  @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
  @Header('Cache-Control', 'no-cache')
  async debugAllMints(@Param('tokenName') tokenName: KnownTokenName): Promise<MintInfo[]> {

    if (this.configService.get('environment') !== 'development') {
      throw new ForbiddenException('This method should not be called on production');
    }

    const contractService = this.moduleRef.get<ContractService>(tokenName);
    return await contractService.getAllCurrentMints();
  }

  @Get(['api/debugRawMetadata/:tokenName'])
  @ApiOperation({ operationId: 'debugRawMetadata' })
  @ApiParam({
    name: 'tokenName',
    enum: KnownTokenName,
    example: KnownTokenName.genesis,
  })
  @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
  @Header('Cache-Control', 'no-cache')
  debugRawMetadata(@Param('tokenName') tokenName: KnownTokenName) {

    if (this.configService.get('environment') !== 'development') {
      throw new ForbiddenException('This method should not be called on production');
    }

    let rawMetadata: Metadata[];

    if (tokenName === KnownTokenName.genesis) {
      rawMetadata = this.metadataGenesisService.generateRawGenesisMetadata();
      return {
        amountOfTokens: rawMetadata.length,
        metadata: rawMetadata
      }
    }

    throw new NotImplementedException('This token is not ready yet!');
  }

  @Get(['api/allTokenMetadata/:tokenName'])
  @ApiOperation({ operationId: 'allTokenMetadata' })
  @ApiParam({
    name: 'tokenName',
    enum: KnownTokenName,
    example: KnownTokenName.genesis,
  })
  @ApiOkResponse({ type: Metadata, isArray: true })
  @Header('Cache-Control', 'no-cache')
  async allTokenMetadata(@Param('tokenName') tokenName: KnownTokenName): Promise<Metadata[]> {

    const contractService = this.moduleRef.get<ContractService>(tokenName);
    const allMints = await contractService.getAllCurrentMints();

    if (tokenName === KnownTokenName.genesis) {
      return this.metadataGenesisService.generateMetadata(allMints);
    }

    throw new NotImplementedException('This token is not ready yet!');
  }

  @Get(['api/tokenMetadata/:tokenName/:tokenId'])
  @ApiOperation({ operationId: 'tokenMetadata' })
  @ApiParam({ name: 'tokenName', enum: KnownTokenName, example: KnownTokenName.genesis })
  @ApiParam({ name: 'tokenId', type: 'number' })
  @ApiOkResponse({ type: Metadata })
  @ApiNotFoundResponse({ description: 'Unknown tokenId' })
  @Header('Cache-Control', 'public, max-age=' + tenMinutesInSeconds + ', immutable')
  async tokenMetadata(@Param('tokenName') tokenName: KnownTokenName, @Param('tokenId', ParseIntPipe) tokenId: number): Promise<Metadata> {

    const allMints = await this.allTokenMetadata(tokenName);
    const token = allMints.find(x =>  x.tokenId === tokenId);

    if (!token) {
      throw new NotFoundException('Unknown tokenId');
    }

    return token;
  }

  @Get(['api/tokenMetadata/:tokenName/:tokenId/:tile1/:tile2/:tile3/:tile4'])
  @ApiOperation({ operationId: 'tokenMetadataMosaic' })
  @ApiParam({ name: 'tokenName', enum: KnownTokenName, example: KnownTokenName.genesis })
  @ApiParam({ name: 'tokenId', type: 'number' })
  @ApiParam({ name: 'tile1', type: 'number' })
  @ApiParam({ name: 'tile2', type: 'number' })
  @ApiParam({ name: 'tile3', type: 'number' })
  @ApiParam({ name: 'tile4', type: 'number' })
  @ApiOkResponse({ type: Metadata })
  @ApiNotFoundResponse({ description: 'Unknown tokenId' })
  @Header('Cache-Control', 'public, max-age=' + tenMinutesInSeconds + ', immutable')
  async tokenMetadataMosaic(
    @Param('tokenName') tokenName: KnownTokenName, @Param('tokenId', ParseIntPipe) tokenId: number,
    @Param('tile1', ParseIntPipe) tile1: number,
    @Param('tile2', ParseIntPipe) tile2: number,
    @Param('tile3', ParseIntPipe) tile3: number,
    @Param('tile4', ParseIntPipe) tile4: number
  ): Promise<Metadata> {
    return this.tokenMetadata(tokenName, tokenId)
  }

  @Get(['api/tokenPreview/:tokenName/:tokenId'])
  @ApiOperation({ operationId: 'tokenPreview' })
  @ApiParam({ name: 'tokenName', enum: [KnownTokenName.genesis, KnownTokenName.mosaic], example: KnownTokenName.genesis })
  @ApiParam({ name: 'tokenId', type: 'number' })
  @ApiOkResponse({ type: Metadata, isArray: true })
  @ApiNotFoundResponse({ description: 'Unknown tokenId' })
  @Header('Cache-Control', 'public, max-age=' + oneWeekInSeconds + ', immutable')
  async tokenPreview(@Param('tokenName') tokenName: KnownTokenName, @Param('tokenId', ParseIntPipe) tokenId: number, @Res() response: express.Response) {

    const allMints = await this.allTokenMetadata(tokenName);
    const mosaic = allMints.find(x =>  x.tokenId === tokenId);

    if (!mosaic) {
      throw new NotFoundException('Unknown tokenId');
    }

    if (!mosaic.isMosaic) {
      throw new NotFoundException('This token is not a mosaic');
    }

    const imageBuffer = await this.imageService.getMosiacPreview(tokenName, tokenId, mosaic);
    response.setHeader('Content-Type', 'image/png',);
    return response.send(imageBuffer);
  }

  @Get(['api/tokenAnimation/:tokenName/:tokenId'])
  @ApiOperation({ operationId: 'tokenAnimation' })
  @ApiParam({ name: 'tokenName', enum: KnownTokenName, example: KnownTokenName.genesis })
  @ApiParam({ name: 'tokenId', type: 'number' })
  @ApiOkResponse({ type: String })
  @ApiNotFoundResponse({ description: 'Unknown tokenId' })
  @Header('Cache-Control', 'public, max-age=' + oneWeekInSeconds + ', immutable')
  async tokenAnimation(@Param('tokenName') tokenName: KnownTokenName, @Param('tokenId', ParseIntPipe) tokenId: number): Promise<string> {

    return this.tokenAnimationMosaic(tokenName, tokenId, 0 , 0, 0, 0)
  }

  @Get(['api/tokenAnimation/:tokenName/:tokenId/:tile1/:tile2/:tile3/:tile4'])
  @ApiOperation({ operationId: 'tokenAnimationMosaic' })
  @ApiParam({ name: 'tokenName', enum: KnownTokenName, example: KnownTokenName.genesis })
  @ApiParam({ name: 'tokenId', type: 'number' })
  @ApiParam({ name: 'tile1', type: 'number' })
  @ApiParam({ name: 'tile2', type: 'number' })
  @ApiParam({ name: 'tile3', type: 'number' })
  @ApiParam({ name: 'tile4', type: 'number' })
  @ApiOkResponse({ type: String })
  @Header('Cache-Control', 'public, max-age=' + oneWeekInSeconds + ', immutable')
  async tokenAnimationMosaic(
    @Param('tokenName') tokenName: KnownTokenName,
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Param('tile1', ParseIntPipe) tile1: number,
    @Param('tile2', ParseIntPipe) tile2: number,
    @Param('tile3', ParseIntPipe) tile3: number,
    @Param('tile4', ParseIntPipe) tile4: number): Promise<string> {

    const allMints = await this.allTokenMetadata(tokenName);
    const noTiles = tile1 === 0 && tile2 === 0 && tile3 ===  0 && tile4 === 0;

    // token can be also null, then we are in preview mode
    const token = allMints.find(x =>  x.tokenId === tokenId);

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Genesis by HAUS HOPPE → ${ token?.name } (Token #${ tokenId })</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="/public/logo.svg">
    <link rel="stylesheet" href="/public/style-mosaic.css">
  </head>
  <body>

<div class="square">
${
  noTiles ?
  this.imageService.getAnimationHtml(tokenId, allMints) :
  this.imageService.getMosaicAnimationHtml(tokenId, tile1, tile2, tile3, tile4, allMints) }
</div>

  </body>
</html>
`;
  }

  @Get(['api/allTokenOwners/:tokenName'])
  @ApiOperation({ operationId: 'allTokenOwners  ' })
  @ApiParam({
    name: 'tokenName',
    enum: KnownTokenName,
    example: KnownTokenName.genesis,
  })
  @ApiResponse({ type: TokenOwner, isArray: true })
  @Header('Cache-Control', 'no-cache')
  async allTokenOwners(@Param('tokenName') tokenName: KnownTokenName): Promise<object> {
    const contractService = this.moduleRef.get<ContractService>(tokenName);
    return await contractService.getAllCurrentTokenOwners();
  }

  @Get(['api/tokenOwner/:tokenName/:tokenId'])
  @ApiOperation({ operationId: 'tokenOwner' })
  @ApiParam({ name: 'tokenName', enum: KnownTokenName, example: KnownTokenName.genesis })
  @ApiParam({ name: 'tokenId', type: 'number' })
  @ApiOkResponse({ type: TokenOwner })
  @ApiNotFoundResponse({ description: 'Unknown tokenId' })
  @Header('Cache-Control', 'no-cache')
  async tokenOwner(@Param('tokenName') tokenName: KnownTokenName, @Param('tokenId', ParseIntPipe) tokenId: number): Promise<TokenOwner> {

    const contractService = this.moduleRef.get<ContractService>(tokenName);
    const allTokenOwners = await contractService.getAllCurrentTokenOwners();
    const tokenOwner = allTokenOwners[tokenId];

    if (!tokenOwner) {
      throw new NotFoundException('Unknown tokenId');
    }

    return tokenOwner;
  }
}


