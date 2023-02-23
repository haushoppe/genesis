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

import {
  createFallbackImage,
  createGenesisMosaicMetadata,
  createRawGenesisMetadata,
  genesisRawArtworks,
} from '../../assets/data/tokendata_genesis';
import { AllowlistService } from '../model/allowlist.service';
import { ContractService } from '../model/contract.service';
import { formatSeconds } from '../model/date-utils';
import { encodePackedMessage, getSigner, hashMessage, signMessage } from '../model/ethers-utils';
import { ImageService } from '../model/image.service';
import { MetadataService } from '../model/metadata.service';
import { oneWeekInSeconds, tenMinutesInSeconds } from '../types/constants';
import { KnownTokenConfig } from '../config/known-token-config';
import { KnownTokenName } from '../../../../shared/known-token-name';
import { Metadata } from '../types/metadata';
import { MintRequest } from '../types/mint-request';
import { MintTicket } from '../types/mint-ticket';
import { StatusResponse } from '../types/status-response';
import { KnownChains } from '../config/known-chains';


@ApiTags('api')
@Controller()
export class ApiController {

  private knownTokens = this.configService.get<KnownTokenConfig[]>('knownTokens');

  constructor(
    private configService: ConfigService,
    private allowlistService: AllowlistService,
    private contractService: ContractService,
    private metadataService: MetadataService,
    private imageService: ImageService) { }

  /**
   * Minting via allowlist
   *
   * Allow for minting of tokens up to the maximum allowed for a given address.
   * The address of the sender and the number of mints allowed are hashed and signed
   * with the server's private key and verified on-chain to prove allowlist status.
   */
  @Post(['api/mintAllowlist'])
  @ApiOperation({ operationId: 'mintAllowlist' })
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
  @Get(['api/status/:tokenName'])
  @ApiOperation({ operationId: 'status' })
  @ApiParam({
    name: 'tokenName',
    description: 'Limits the contract details to one token',
    enum: ['all', ...Object.keys(KnownTokenName)],
    example: KnownTokenName.genesis,
  })
  @ApiResponse({ type: StatusResponse, isArray: true })
  @Header('Cache-Control', 'no-cache')
  async status(@Param('tokenName') tokenName: 'all' | KnownTokenName): Promise<StatusResponse> {

    let knownTokens = this.knownTokens;

    if (tokenName !== 'all') {
      knownTokens = [knownTokens.find(x => x.name === tokenName)];
    }

    return {
      environment: this.configService.get('environment'),
      uptime: formatSeconds(process.uptime()),
      knownTokens: await Promise.all(knownTokens.map(async token => ({
        name: token.name,
        maximumAllowedMintsPerAddress: token.maximumAllowedMintsPerAddress,
        address: token.address,
        networkName: token.networkName,
        networkConfig: {
          ...KnownChains[token.networkName],
          rpcUrl: KnownChains[token.networkName].rpcUrl.replace('API_KEY', this.configService.get<string>('alchemyKey_' + token.networkName))
        },
        firstBlockNumber: token.firstBlockNumber,
        implementsMosaics: token.implementsMosaics,
        explorerLink: KnownChains[token.networkName].blockExplorerUrl + '/address/' + token.address,
        signer: getSigner(this.configService.get('signerKey_' + token.name)).address,
        allowlistEntries: this.allowlistService.getMintWallets(token.name).length,
        contractName: (await this.contractService.getContractName(token.name)),
        totalSupply: (await this.contractService.getTotalSupply(token.name))
      })))
    };
  }

  @Get(['api/debugMints/:tokenName'])
  @ApiOperation({ operationId: 'debugMints' })
  @ApiParam({
    name: 'tokenName',
    enum: KnownTokenName,
    example: KnownTokenName.genesis,
  })
  @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
  @Header('Cache-Control', 'no-cache')
  async debugMints(@Param('tokenName') tokenName: KnownTokenName) {

    if (this.configService.get('environment') !== 'development') {
      throw new ForbiddenException('This method should not be called on production');
    }

    return await this.contractService.getAllMints(tokenName);
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
      rawMetadata = createRawGenesisMetadata(genesisRawArtworks, this.configService.get('environment'));
      return {
        amountOfTokens: rawMetadata.length,
        metadata: rawMetadata
      }
    }

    throw new NotImplementedException('This token is not ready yet!');
  }

  @Get(['api/allMints/:tokenName'])
  @ApiOperation({ operationId: 'allMints' })
  @ApiParam({
    name: 'tokenName',
    enum: KnownTokenName,
    example: KnownTokenName.genesis,
  })
  @ApiOkResponse({ type: Metadata, isArray: true })
  @Header('Cache-Control', 'no-cache')
  async allMints(@Param('tokenName') tokenName: KnownTokenName): Promise<Metadata[]> {

    const allMints = await this.contractService.getAllMints(tokenName);

    let rawMetadata: Metadata[];

    if (tokenName === KnownTokenName.genesis) {
      rawMetadata = createRawGenesisMetadata(genesisRawArtworks, this.configService.get('environment'));
      return this.metadataService.generateMetadata(
        allMints,
        rawMetadata,
        createGenesisMosaicMetadata,
        createFallbackImage);
    }

    throw new NotImplementedException('This token is not ready yet!');
  }

  @Get(['api/tokenInfo/:tokenName/:tokenId'])
  @ApiOperation({ operationId: 'tokenInfo' })
  @ApiParam({ name: 'tokenName', enum: KnownTokenName, example: KnownTokenName.genesis })
  @ApiParam({ name: 'tokenId', type: 'number' })
  @ApiOkResponse({ type: Metadata })
  @ApiNotFoundResponse({ description: 'Unknown tokenId' })
  @Header('Cache-Control', 'public, max-age=' + tenMinutesInSeconds + ', immutable')
  async tokenInfo(@Param('tokenName') tokenName: KnownTokenName, @Param('tokenId', ParseIntPipe) tokenId: number): Promise<Metadata> {

    const allMints = await this.allMints(tokenName);
    const token = allMints.find(x =>  x.tokenId === tokenId);

    if (!token) {
      throw new NotFoundException('Unknown tokenId');
    }

    return token;
  }

  @Get(['api/tokenInfo/:tokenName/:tokenId/:tile1/:tile2/:tile3/:tile4'])
  @ApiOperation({ operationId: 'tokenInfoMosaic' })
  @ApiParam({ name: 'tokenName', enum: KnownTokenName, example: KnownTokenName.genesis })
  @ApiParam({ name: 'tokenId', type: 'number' })
  @ApiParam({ name: 'tile1', type: 'number' })
  @ApiParam({ name: 'tile2', type: 'number' })
  @ApiParam({ name: 'tile3', type: 'number' })
  @ApiParam({ name: 'tile4', type: 'number' })
  @ApiOkResponse({ type: Metadata })
  @ApiNotFoundResponse({ description: 'Unknown tokenId' })
  @Header('Cache-Control', 'public, max-age=' + tenMinutesInSeconds + ', immutable')
  async tokenInfoMosaic(
    @Param('tokenName') tokenName: KnownTokenName, @Param('tokenId', ParseIntPipe) tokenId: number,
    @Param('tile1', ParseIntPipe) tile1: number,
    @Param('tile2', ParseIntPipe) tile2: number,
    @Param('tile3', ParseIntPipe) tile3: number,
    @Param('tile4', ParseIntPipe) tile4: number
  ): Promise<Metadata> {
    return this.tokenInfo(tokenName, tokenId)
  }

  @Get(['api/tokenPreview/:tokenName/:tokenId'])
  @ApiOperation({ operationId: 'tokenPreview' })
  @ApiParam({ name: 'tokenName', enum: [KnownTokenName.genesis, KnownTokenName.mosaic], example: KnownTokenName.genesis })
  @ApiParam({ name: 'tokenId', type: 'number' })
  @ApiOkResponse({ type: Metadata, isArray: true })
  @ApiNotFoundResponse({ description: 'Unknown tokenId' })
  @Header('Cache-Control', 'public, max-age=' + oneWeekInSeconds + ', immutable')
  async tokenPreview(@Param('tokenName') tokenName: KnownTokenName, @Param('tokenId', ParseIntPipe) tokenId: number, @Res() response: express.Response) {

    const allMints = await this.allMints(tokenName);
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

    const allMints = await this.allMints(tokenName);
    const noTiles = tile1 === 0 && tile2 === 0 && tile3 ===  0 && tile4 === 0;

    // token can be also null, then we are in preview mode
    const token = allMints.find(x =>  x.tokenId === tokenId);

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Genesis NFT by HAUS HOPPE → ${ token?.name } (Token #${ tokenId })</title>
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
}


