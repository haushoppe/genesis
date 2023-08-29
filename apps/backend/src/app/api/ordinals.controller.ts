import { Body, Controller, ForbiddenException, Get, Header, Logger, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { apikeyCreate, getApikeyDetails, ordinalnovusSearchForText } from '../../../../shared/ordinalnovus';
import {
  createInscriptionRequestForHtml,
  getFxrate,
  getOrderStatus,
  getPrice,
  getReferralStatus,
  saveReferralCode,
  searchForText,
} from '../../../../shared/ordinalsbot';
import { InscriptionOrder, OrderResponse } from '../../../../shared/ordinalsbot-order-response';
import { REFERRALS, validateCode } from '../../../../shared/referrals';
import { CacheService } from '../model/cache.service';
import { limitArray } from '../model/limit-array';
import { oneMinuteInSeconds, tenMinutesInSeconds } from '../types/constants';
import { Attribute } from '../types/ordinals/attribute';
import { HtmlInscriptionRequest } from '../types/ordinals/html-inscription-request';
import { Inscription } from '../types/ordinals/inscription';
import { InscriptionSimple } from '../types/ordinals/inscription-simple';
import { Price } from '../types/ordinals/price';

function hideUnwantedProperties({ charge, files, paid, referral }: OrderResponse): InscriptionOrder {

  const { id, amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value } = charge;

  return {
    id, // id at the root, and not down below charge!
    charge: {
      amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value
    },
    files: files.map(({ completed, dataURL, iqueued, sent, tx }) => ({
      completed,
      dataURL,
      iqueued,
      sent,
      tx
    })),
    paid,
    code: referral === REFERRALS[0].code ? '' : referral
  };
}

function parseCube(cubeHtmlRaw: string): Attribute[] {

  const template1 = `<html><!--cubes.haushoppe.art--><body><script>t='`;
  let cubeHtml = cubeHtmlRaw.replace(template1, '');
  cubeHtml = cubeHtml.split('\'')[0];
  const data = cubeHtml.split('|');

  let version = '?';
  if (cubeHtmlRaw.includes('<script src=/content/9475aa8df559d569f7284ce59e97014f28be758e832e212fdbba0202699dd035i0></script>')) {
    version = 'v1';
  }
  if (cubeHtmlRaw.includes('<script src=/content/4c5b32a1bd0dc43b3540097bf0135de6b0389f55fe6fe06910e5393bf6591a42i0></script>')) {
    version = 'v2';
  }
  if (cubeHtmlRaw.includes('<script src=/content/fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0></script>')) {
    version = 'v3';
  }

  return [
    { 'trait_type': 'Side 1', 'value': data[0] },
    { 'trait_type': 'Side 2', 'value': data[1] },
    { 'trait_type': 'Side 3', 'value': data[2] },
    { 'trait_type': 'Side 4', 'value': data[3] },
    { 'trait_type': 'Side 5', 'value': data[4] },
    { 'trait_type': 'Side 6', 'value': data[5] },
    { 'trait_type': 'Version', 'value': version }
  ];
}

@ApiTags('ordinals')
@Controller()
export class OrdinalsController {

  constructor(private configService: ConfigService,
    private cacheService: CacheService) {
    this.getCubes();
  }

  /**
   * Creating an Inscription Order
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
   * Get inscription order updates
   */
  @Get(['ordinals/getOrderStatus/:id'])
  @ApiOperation({ operationId: 'getOrderStatus' })
  @ApiParam({
    name: 'id',
    description: 'order Id'
  })
  @Header('Cache-Control', 'no-cache')
  async getOrderStatus(@Param('id') orderId: string): Promise<InscriptionOrder> {

    const orderResponseFull = await getOrderStatus(orderId);
    return hideUnwantedProperties(orderResponseFull);
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

      const searchResult = await searchForText('cubes.haushoppe.art');
      let simple = searchResult.results
        .filter(x => x.contentstr.includes('<html><!--cubes.haushoppe.art--><body><script>'))
        .map((x, index) => ({
          inscriptionId: x.inscriptionid,
          meta: {
            name: 'Ordinal Cube #' + index,
            attributes: parseCube(x.contentstr)
          }
        }))
        .reverse();

      Logger.log('Fetched ' + simple.length + ' cubes', 'ordinals_cubes');

      simple = limitArray(simple, 12);
      this.lastBackup = simple;
      Logger.log('Limited the array to 12 entries!', 'ordinals_cubes');

      return simple;
    };

    try {
      return this.cacheService.loadCached('ordinal_cubes', simpleResult, tenMinutesInSeconds);
    } catch {
      return this.lastBackup;
    }
  }

  /**
   * Get known cubes metadata (cached!)
   */
  @Get(['ordinals/getCubesMetadata'])
  @ApiOperation({ operationId: 'getCubesMetadata' })
  @ApiOkResponse({ type: Inscription, isArray: true })
  @Header('Cache-Control', 'public, max-age=' + oneMinuteInSeconds + ', immutable')
  async getCubesMetadata(): Promise<Inscription[]> {

    const simpleResult = async () => {

      const searchResult = await searchForText('cubes.haushoppe.art');
      return searchResult.results
        .filter(x => x.contentstr.includes('<html><!--cubes.haushoppe.art--><body><script>'))
        .map((x, index) => ({
          id: x.inscriptionid,
          meta: {
            name: 'Ordinal Cube #' + index,
            attributes: parseCube(x.contentstr)
          }
        }));
    };

    return this.cacheService.loadCached('ordinal_cubes_metadata', simpleResult, tenMinutesInSeconds);

  }

  /**
   * Get price in sats (cached!)
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

      const referral = validateCode(code);

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
