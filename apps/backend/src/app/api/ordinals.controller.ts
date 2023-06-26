import { Body, Controller, ForbiddenException, Get, Header, Logger, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiTags } from '@nestjs/swagger';

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
import { oneMinuteInSeconds, tenMinutesInSeconds } from '../types/constants';
import { HtmlInscriptionRequest } from '../types/html-inscription-request';

export class InscriptionSimple {
  @ApiProperty() inscriptionId: string;
  @ApiProperty() blockheight: number;
}

export class Price {
  @ApiProperty() priceInSats: number;
  @ApiProperty() priceInUsd: number;

}

function hideUnwantedProperties({ charge, files, referral }: OrderResponse): InscriptionOrder {

  const { id,  amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value } = charge;

  return {
    id, // id at the root, and not down below charge!
    charge: {
      amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value
    },
    files: files.map(({ completed, sent, tx }) => ({
      completed, sent, tx
    })),
    code: referral === REFERRALS[0].code ? '' : referral
  };
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
      const simple = searchResult.results
        .filter(x => x.contentstr.includes('<html><!--cubes.haushoppe.art--><body><script>'))
        .map(x => ({
          inscriptionId: x.inscriptionid,
          blockheight: x.blockheight
        }))
        .reverse();

      this.lastBackup = simple;
      Logger.log('Fetched ' + simple.length + ' cubes', 'ordinals_cubes')
      return simple;
    };

    try {
      return this.cacheService.loadCached('ordinal_cubes', simpleResult, tenMinutesInSeconds);
    } catch {
      return this.lastBackup;
    }
  }

    /**
     * Get price in sats (cached!)
     */
    @Get(['ordinals/getPrice/:fee/:size'])
    @ApiOperation({ operationId: 'getPrice' })
    @ApiParam({ name: 'fee', type: 'number' })
    @ApiParam({ name: 'size', type: 'number' })
    @ApiParam({ name: 'code', type: 'string' })
    @ApiOkResponse({ type: Price })
    @Header('Cache-Control', 'public, max-age=' + oneMinuteInSeconds + ', immutable')
    async getPrice(
      @Param('fee', ParseIntPipe) fee: number,
      @Param('size', ParseIntPipe) size: number,
      @Param('code') code: string): Promise<Price> {

        return this.cacheService.loadCached('ordinal_price_' + fee + '_' + size, async () => {

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
}
