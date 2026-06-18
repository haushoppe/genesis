import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
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

import { KnownTokenName } from '../../shared/known-token-name';
import { KnownChains } from '../config/known-chains';
import { KnownTokenConfig } from '../config/known-token-config';
import { AllowlistService } from '../model/allowlist.service';
import { ContractService } from '../model/contract.service';
import { formatSeconds } from '../model/date-utils';
import { ZERO_ADDRESS, encodePackedMessage, getSigner, hashMessage, signMessage } from '../model/ethers-utils';
import { ImageService } from '../model/image.service';
import { ConfigResponse } from '../types/config-response';
import { oneWeekInSeconds, tenMinutesInSeconds } from '../types/constants';
import { ListOfOwnedTokens } from '../types/list-of-owned-tokens';
import { Metadata } from '../types/metadata';
import { MintInfo } from '../types/mint-info';
import { MintRequest } from '../types/mint-request';
import { MintTicket } from '../types/mint-ticket';
import { TokenOwner } from '../types/token-owner';


@ApiTags('api')
@Controller()
export class ApiController {

  private knownTokens = this.configService.get<KnownTokenConfig[]>('knownTokens');

  constructor(
    private configService: ConfigService,
    private allowlistService: AllowlistService,
    private imageService: ImageService,
    private moduleRef: ModuleRef) { }

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

    Logger.verbose(`Mint ticked requested by sender ${sender}`, tokenName);

    if (!this.knownTokens.map(x => x.name).includes(tokenName)) {
      throw new NotFoundException('Unknown token name');
    }

    if (sender === ZERO_ADDRESS) {
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
    const maximumAllowedMints = 8;

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

    if (contractService.disabled) {
      return {
        environment: this.configService.get('environment'),
        uptime: formatSeconds(process.uptime()),
        config: null
      }
    }

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
        priceForMosaic: (await contractService.getPriceForMosaic()),
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
    return await contractService.getAllMints();
  }

  /**
   * Returns the token metedata of all tokens of the collection
   */
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
    return await contractService.getAllTokenMetadata()
  }

  /**
   * Returns the token metadata of all tokens of a given owner address
   */
    @Get(['api/allTokenMetadata/:tokenName/:ownerAddress'])
    @ApiOperation({ operationId: 'allTokenMetadataOfOwner' })
    @ApiParam({
      name: 'tokenName',
      enum: KnownTokenName,
      example: KnownTokenName.genesis,
    })
    @ApiParam({ name: 'ownerAddress', type: 'string', example: ZERO_ADDRESS })
    @ApiOkResponse({ type: ListOfOwnedTokens })
    @Header('Cache-Control', 'no-cache')
    async allTokenMetadataOfOwner(@Param('tokenName') tokenName: KnownTokenName, @Param('ownerAddress') ownerAddress: string): Promise<ListOfOwnedTokens> {

      ownerAddress = ownerAddress.toLowerCase();

      const allMints = await this.allTokenMetadata(tokenName);
      const allTokenOwners = await this.allTokenOwners(tokenName);

      const allTokensIdsWhereOwner = allTokenOwners.filter(x => x.owner.toLowerCase() === ownerAddress).map(x => x.tokenId);
      const allTokensIdsWhereLender = allTokenOwners.filter(x => x.lender && x.lender.toLowerCase() === ownerAddress).map(x => x.tokenId);


      const owned = allMints.filter(x => allTokensIdsWhereOwner.find(tokenId => x.tokenId === tokenId));
      const lended = allMints.filter(x => allTokensIdsWhereLender.find(tokenId => x.tokenId === tokenId));

      return { owned, lended }
    }

  /**
   * Returns the token metedata (target of the tokenURI function of the ERC721 contract)
   */
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

  /**
   * Returns the token metedata of a mosaic (target of the tokenURI function of the ERC721 contract)
   */
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

  /**
   * Returns the preview image of a token
   */
  @Get(['api/tokenPreview/:tokenName/:tokenId'])
  @ApiOperation({ operationId: 'tokenPreview' })
  @ApiParam({ name: 'tokenName', enum: [KnownTokenName.genesis, KnownTokenName.mosaic], example: KnownTokenName.genesis })
  @ApiParam({ name: 'tokenId', type: 'number' })
  @ApiOkResponse({ type: Metadata, isArray: true })
  @ApiNotFoundResponse({ description: 'Unknown tokenId' })
  @Header('Cache-Control', 'public, max-age=' + oneWeekInSeconds + ', immutable')
  async tokenPreview(@Param('tokenName') tokenName: KnownTokenName, @Param('tokenId', ParseIntPipe) tokenId: number, @Res() response: express.Response) {

    const allMints = await this.allTokenMetadata(tokenName);
    const token = allMints.find(x =>  x.tokenId === tokenId);

    if (!token) {
      throw new NotFoundException('Unknown tokenId');
    }

    const imageBuffer = await this.imageService.getPreview(allMints, tokenName, tokenId);

    response.setHeader('Content-Type', 'image/png',);
    return response.send(imageBuffer);
  }

  /**
   * Returns the HTML page that is used for the animation_url of the token (for a normal token)
   */
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

  /**
   * Returns the HTML page that is used for the animation_url of the token (for a mosaic)
   */
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

  /**
   * Returns the token owners (current owner and lender) of all tokens of the collection
   */
  @Get(['api/allTokenOwners/:tokenName'])
  @ApiOperation({ operationId: 'allTokenOwners  ' })
  @ApiParam({
    name: 'tokenName',
    enum: KnownTokenName,
    example: KnownTokenName.genesis,
  })
  @ApiResponse({ type: TokenOwner, isArray: true })
  @Header('Cache-Control', 'no-cache')
  async allTokenOwners(@Param('tokenName') tokenName: KnownTokenName): Promise<TokenOwner[]> {
    const contractService = this.moduleRef.get<ContractService>(tokenName);
    return await contractService.getAllTokenOwners();
  }

  /**
   * Returns the token owners (current owner and lender) of a token
   */
  @Get(['api/tokenOwner/:tokenName/:tokenId'])
  @ApiOperation({ operationId: 'tokenOwner' })
  @ApiParam({ name: 'tokenName', enum: KnownTokenName, example: KnownTokenName.genesis })
  @ApiParam({ name: 'tokenId', type: 'number' })
  @ApiOkResponse({ type: TokenOwner })
  @ApiNotFoundResponse({ description: 'Unknown tokenId' })
  @Header('Cache-Control', 'no-cache')
  async tokenOwner(@Param('tokenName') tokenName: KnownTokenName, @Param('tokenId', ParseIntPipe) tokenId: number): Promise<TokenOwner> {

    const contractService = this.moduleRef.get<ContractService>(tokenName);
    const allTokenOwners = await contractService.getAllTokenOwners();
    const tokenOwner = allTokenOwners[tokenId];

    if (!tokenOwner) {
      throw new NotFoundException('Unknown tokenId');
    }

    return tokenOwner;
  }
}


