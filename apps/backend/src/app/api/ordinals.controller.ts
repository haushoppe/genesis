import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { InscriptionFile, InscriptionOrder, isErrorResponse } from '../../../../shared/ordinals/ordinalsbot-order-response';
import { KnownCollectionName } from '../../../../shared/ordinals/known-collection-name';
import { CacheService } from '../model/cache.service';
import { paginateArray } from '../model/paginate-array';

import { findItemByInscriptionId, hideUnwantedProperties } from '../model/ordinals/inscription-helper';
import { CubeSuggestionService } from '../model/ordinals/cube-suggestion.service';
import { CubeService } from '../model/ordinals/cube.service';
import {
  createInscriptionRequestForHtml,
  getFxrate,
  getOrderStatus,
  getPrice,
  getReferralStatus,
  loadHostedContent,
  saveReferralCode,
} from '../model/ordinals/ordinalsbot';
import { validateReferralCode } from '../model/ordinals/validate-referral-code';
import { oneMinuteInSeconds } from '../types/constants';
import { CubeSuggestion } from '../types/ordinals/cube-suggestion';
import { HtmlInscriptionRequest } from '../types/ordinals/html-inscription-request';
import { InscriptionStandad as InscriptionStandard } from '../types/ordinals/inscription-standard';
import { InscriptionExtended, InscriptionExtendedPaginatedResult, InscriptionExtendedSingleResult } from '../types/ordinals/inscription-extended';
import { Price } from '../types/ordinals/price';


@ApiTags('ordinals')
@Controller()
export class OrdinalsController {

  constructor(private configService: ConfigService,
    private cacheService: CacheService,
    private cubeService: CubeService,
    private cubeSuggestionService: CubeSuggestionService) {
  }

  /**
   * Creating an Inscription Order via OrdinalsBot
   */
  @Post(['ordinals/createHtmlInscriptionOrder'])
  @ApiOperation({ operationId: 'createHtmlInscriptionOrder' })
  async createHtmlInscriptionOrder(@Body() request: HtmlInscriptionRequest): Promise<InscriptionOrder> {

    const buff = Buffer.from(request.htmlString);

    // Convert the HTML string to a base64 encoded string
    const contentB64 = buff.toString('base64');
    const size = buff.length;

    const orderResponseFull = await createInscriptionRequestForHtml(
      request.receiveAddress,
      size,
      request.fee,
      contentB64,
      request.code
    );

    return hideUnwantedProperties(orderResponseFull);
  }

  /**
   * Get inscription order updates from OrdinalsBot
   */
  @Get(['ordinals/getOrderStatus/:id'])
  @ApiOperation({ operationId: 'getOrderStatus' })
  @ApiParam({
    name: 'id',
    description: 'order Id'
  })
  @Header('Cache-Control', 'no-cache')
  @ApiNotFoundResponse({ description: 'No such order' })
  async getOrderStatus(@Param('id') orderId: string): Promise<InscriptionOrder> {

    const orderResponseFull = await getOrderStatus(orderId);

    if (isErrorResponse(orderResponseFull)) {
      throw new NotFoundException(orderResponseFull.error);
    }

    const fileOne: InscriptionFile | undefined = orderResponseFull.files[0];

    // Fetch and cache dataUrl if not already available
    if (fileOne && fileOne.url && !fileOne.dataURL) {

      const base64encodedHtml = await this.fetchAndCacheFileContent(fileOne.url)

    if (base64encodedHtml) {
        fileOne.dataURL = base64encodedHtml;
      }
    }

    return hideUnwantedProperties(orderResponseFull);
  }

  /**
   * Fetches and caches the content of a given URL as a dataURL
   * @param url The file URL to fetch
   * @returns Base64-encoded HTML content or an empty string on failure
   */
  private async fetchAndCacheFileContent(url: string): Promise<string> {
      const cacheKey = `file:${url}`;
      const TTL = 2 * 60 * 60; // 2 hours in seconds
      return this.cacheService.loadCached(cacheKey, async () => loadHostedContent(url), TTL);
  }

  /**
   * Get all known inscriptions (paged and cached)
   */
  @Get(['ordinals/getInscriptions/:collectionName/:itemsPerPage/:currentPage'])
  @ApiOperation({ operationId: 'getInscriptions' })
  @ApiParam({
    name: 'collectionName',
    enum: KnownCollectionName,
    example: KnownCollectionName.cubes,
  })
  @ApiParam({ name: 'itemsPerPage', type: 'number', example: 12 })
  @ApiParam({ name: 'currentPage', type: 'number', example: 1 })
  @ApiOkResponse({ type: InscriptionExtendedPaginatedResult })
  @Header('Cache-Control', 'public, max-age=' + oneMinuteInSeconds + ', immutable')
  async getInscriptions(
    @Param('collectionName') collectionName: KnownCollectionName,
    @Param('itemsPerPage', ParseIntPipe) itemsPerPage: number,
    @Param('currentPage', ParseIntPipe) currentPage: number,
  ): Promise<InscriptionExtendedPaginatedResult> {

    let meta: InscriptionExtended[] = [];

    if (collectionName === KnownCollectionName.cubes) {
      meta = await this.cubeService.getAllCubes();
    }

    const reverseMeta = [...meta].reverse();
    const inscriptions = paginateArray(reverseMeta, itemsPerPage, currentPage);

    return {
      inscriptions,
      totalInscriptions: reverseMeta.length,
      itemsPerPage,
      currentPage
    }
  }

  /**
   * Get a single known inscription (cached)
   */
  @Get(['ordinals/getSingleInscription/:collectionName/:inscriptionId'])
  @ApiOperation({ operationId: 'getSingleInscription' })
  @ApiParam({
    name: 'collectionName',
    enum: KnownCollectionName,
    example: KnownCollectionName.cubes,
  })
  @ApiParam({ name: 'inscriptionId', type: 'string', example: '00ef588330b57ba4586365c9a3663e14bcc14452819ae6c09f99eec291435831i0' })
  @ApiOkResponse({ type: InscriptionExtendedSingleResult })
  @Header('Cache-Control', 'public, max-age=' + oneMinuteInSeconds + ', immutable')
  async getSingleInscription(
    @Param('collectionName') collectionName: KnownCollectionName,
    @Param('inscriptionId') inscriptionId: string
  ): Promise<InscriptionExtendedSingleResult> {

    let meta: InscriptionExtended[] = [];

    if (collectionName === KnownCollectionName.cubes) {
      meta = await this.cubeService.getAllCubes();
    }

    const reverseMeta = [...meta].reverse();
    const inscriptions = findItemByInscriptionId(reverseMeta, inscriptionId);

    return {
      inscription: inscriptions.current,
      previousInscriptionId: inscriptions.previous ? inscriptions.previous.inscriptionId : null,
      nextInscriptionId: inscriptions.next ? inscriptions.next.inscriptionId : null
    }
  }

  /**
   * Get all known inscription metadata (cached) – format of MagicEden and other marketplaces
   */
  @Get(['ordinals/getInscriptionsMetadata/:collectionName'])
  @ApiOperation({ operationId: 'getInscriptionsMetadata' })
  @ApiParam({
    name: 'collectionName',
    enum: KnownCollectionName,
    example: KnownCollectionName.cubes,
  })
  @ApiOkResponse({ type: InscriptionStandard, isArray: true })
  @Header('Cache-Control', 'public, max-age=' + oneMinuteInSeconds + ', immutable')
  async getInscriptionsMetadata(
    @Param('collectionName') collectionName: KnownCollectionName
  ): Promise<InscriptionStandard[]> {

    let meta: InscriptionExtended[] = [];

    if (collectionName === KnownCollectionName.cubes) {
      meta = await this.cubeService.getAllCubes();
    }

    return meta.map(x => ({
      id: x.inscriptionId,
      meta: x.meta
    }));
  }

  /**
   * Get OrdinalsBot price in sats (cached)
   */
  @Get(['ordinals/getPrice/:fee/:size/:code?'])
  @ApiOperation({ operationId: 'getPrice' })
  @ApiParam({ name: 'fee', type: 'number' })
  @ApiParam({ name: 'size', type: 'number' })
  @ApiParam({ name: 'code', type: 'string' })
  @ApiOkResponse({ type: Price })
  @Header('Cache-Control', 'public, max-age=' + oneMinuteInSeconds + ', immutable')
  async getPrice(
    @Param('fee', ParseIntPipe) fee: number,
    @Param('size', ParseIntPipe) size: number,
    @Param('code') code?: string): Promise<Price> {

    return this.cacheService.loadCached('ordinal_price_' + fee + '_' + size + '_' + code, async () => {

      const referral = validateReferralCode(code);

      const price = await getPrice({
        fee,
        size,
        count: 1,
        lowPostage: 'true'
      });

      const fxrate = await getFxrate();

      const priceInSats = price.totalFee + referral.bonus;
      const priceInBtc = (price.totalFee + referral.bonus) / 100000000;
      const priceInUsd = priceInBtc * fxrate.bitcoin.usd;

      return {
        priceInSats,
        priceInUsd
      };
    }, oneMinuteInSeconds);
  }

  /**
   * Get a cube suggestion — six random unclaimed image inscriptions drawn from
   * a randomly chosen popular collection in the frozen Magic Eden archive
   * (https://github.com/ordpool-space/magic-eden-ordinals-archive).
   */
  @Get(['ordinals/getCubeSuggestion/:collectionSymbol?'])
  @ApiOperation({ operationId: 'getCubeSuggestion' })
  @ApiParam({ name: 'collectionSymbol', type: 'string', description: 'Searches only within a specific collection, or in the top collections (EMPTY string).' })
  @ApiOkResponse({ type: CubeSuggestion })
  @ApiNotFoundResponse({ description: 'Could not find enough unclaimed tokens.' })
  @Header('Cache-Control', 'no-cache')
  async getCubeSuggestion(@Param('collectionSymbol') collectionSymbol?: string): Promise<CubeSuggestion> {
    try {
      return await this.cubeSuggestionService.getCubeSuggestion(collectionSymbol);
    } catch (exception) {
      throw new NotFoundException(exception);
    }
  }

  /**
   * Saving Referral Code
   *
   * Use this endpoint to set a unique referral code for yourself.
   */
  @Post(['ordinals/saveReferralCode'])
  @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
  @ApiOperation({ operationId: 'saveReferralCode' })
  async saveReferralCode() {

    if (this.configService.get('environment') !== 'development') {
      throw new ForbiddenException('This method should not be called on production');
    }

    return saveReferralCode();
  }

  /**
   * Saving Referral Code
   *
   * Use this endpoint to set a unique referral code for yourself.
   */
  @Post(['ordinals/getReferralStatus'])
  @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
  @ApiOperation({ operationId: 'getReferralStatus' })
  async getReferralStatus() {

    if (this.configService.get('environment') !== 'development') {
      throw new ForbiddenException('This method should not be called on production');
    }

    return getReferralStatus();
  }
}

