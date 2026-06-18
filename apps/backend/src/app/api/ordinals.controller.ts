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

// Note: the cube read endpoints (getInscriptions, getSingleInscription,
// getInscriptionsMetadata, getCubeSuggestion) have been removed — the
// cubes-frontend now reads those datasets directly from public static
// sources (ordpool-space/ordinal-cubes-index and
// ordpool-space/magic-eden-ordinals-archive). Only the mint flow's order /
// price / referral endpoints remain.

import { InscriptionFile, InscriptionOrder, isErrorResponse } from '../../shared/ordinals/ordinalsbot-order-response';
import { CacheService } from '../model/cache.service';
import { hideUnwantedProperties } from '../model/ordinals/inscription-helper';
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
import { HtmlInscriptionRequest } from '../types/ordinals/html-inscription-request';
import { Price } from '../types/ordinals/price';


@ApiTags('ordinals')
@Controller()
export class OrdinalsController {

  constructor(private configService: ConfigService,
    private cacheService: CacheService) {
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

