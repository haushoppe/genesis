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

import { apikeyCreate, getApikeyDetails, ordinalnovusSearchForText } from '../../../../shared/ordinalnovus';
import { InscriptionOrder, isErrorResponse } from '../../../../shared/ordinalsbot-order-response';
import { CacheService } from '../model/cache.service';
import { limitArray } from '../model/limit-array';
import { hideUnwantedProperties } from '../model/ordinals/cube-helper';
import { CubeSuggestionService } from '../model/ordinals/cube-suggestion.service';
import { CubeService } from '../model/ordinals/cube.service';
import {
  createInscriptionRequestForHtml,
  getFxrate,
  getOrderStatus,
  getPrice,
  getReferralStatus,
  saveReferralCode,
} from '../model/ordinals/ordinalsbot';
import { validateReferralCode } from '../model/ordinals/validate-referral-code';
import { oneMinuteInSeconds } from '../types/constants';
import { CubeSuggestion } from '../types/ordinals/cube-suggestion';
import { HtmlInscriptionRequest } from '../types/ordinals/html-inscription-request';
import { Inscription } from '../types/ordinals/inscription';
import { InscriptionSimple } from '../types/ordinals/inscription-simple';
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
    } else {
      return hideUnwantedProperties(orderResponseFull);
    }
  }

  lastBackup: InscriptionSimple[] = [];

  /**
   * Get known cubes (cached!)
   */
  @Get(['ordinals/getCubes'])
  @ApiOperation({ operationId: 'getCubes' })
  @ApiOkResponse({ type: InscriptionSimple, isArray: true })
  @Header('Cache-Control', 'public, max-age=' + oneMinuteInSeconds + ', immutable')
  async getCubes(): Promise<InscriptionSimple[]> {

    const simpleResult = async () => {

      const meta = (await this.cubeService.getAllCubes()).reverse();
      return limitArray(meta, 12);
    };

    return await this.cacheService.loadCached('ordinal_cubes', simpleResult, oneMinuteInSeconds);
  }

  /**
   * Get known cubes metadata (cached!) – format of MagicEden and others
   */
  @Get(['ordinals/getCubesMetadata'])
  @ApiOperation({ operationId: 'getCubesMetadata' })
  @ApiOkResponse({ type: Inscription, isArray: true })
  @Header('Cache-Control', 'public, max-age=' + oneMinuteInSeconds + ', immutable')
  async getCubesMetadata(): Promise<Inscription[]> {

    const simpleResult = async () => {

      const meta = (await this.cubeService.getAllCubes());
      return meta.map(x => ({
        id: x.inscriptionId,
        meta: x.meta
      }));
    };

    return this.cacheService.loadCached('ordinal_cubes_metadata', simpleResult, oneMinuteInSeconds);
  }

  /**
   * Get OrdinalsBot price in sats (cached!)
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
   * Get cube suggestion from MagicEden
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
        throw new NotFoundException(exception.message);
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

  /**
   * Create Ordinalnovus API key
   *
   * Use this endpoint create an new API key for api.ordinalnovus.com
   */
    @Post(['ordinals/createOrdinalnovusApiKey'])
    @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
    @ApiOperation({ operationId: 'createOrdinalnovusApiKey' })
    async createOrdinalnovusApiKey(): Promise<{
      message: string,
      apiKey: string
    }> {

      if (this.configService.get('environment') !== 'development') {
        throw new ForbiddenException('This method should not be called on production');
      }

      // ??? - Xverse Account 1: Ordinals address
      return apikeyCreate('???')
  }

  /**
   * Get Ordinalnovus API key details
   *
   * Use this endpoint query all details for our API key
   */
  @Post(['ordinals/getOrdinalnovusApiKeyDetails'])
  @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
  @ApiOperation({ operationId: 'getOrdinalnovusApiKeyDetails' })
  async getOrdinalnovusApiKeyDetails(): Promise<{
    success: boolean,
    usage: number,
    userType: string,
    rateLimit: number,
    expirationDate: string
  }> {

    if (this.configService.get('environment') !== 'development') {
      throw new ForbiddenException('This method should not be called on production');
    }

    return getApikeyDetails();
  }

  /**
   * Test for search
   *
   * Use this endpoint query all details for our API key
   */
    @Post(['ordinals/ordinalnovusSearchForText'])
    @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
    @ApiOperation({ operationId: 'ordinalnovusSearchForText' })
    async ordinalnovusSearchForText(): Promise<any> {

      if (this.configService.get('environment') !== 'development') {
        throw new ForbiddenException('This method should not be called on production');
      }

      return ordinalnovusSearchForText('cubes.haushoppe.art');
    }
}

