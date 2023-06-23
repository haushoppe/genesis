import { Body, Controller, ForbiddenException, Get, Header, Logger, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiTags } from '@nestjs/swagger';

import { createInscriptionRequestForHtml, getOrderStatus, getReferralStatus, saveReferralCode, searchForText } from '../../../../shared/ordinalsbot';
import { OrderResponse } from '../../../../shared/ordinalsbot-order-response';
import { HtmlInscriptionRequest } from '../types/html-inscription-request';
import { oneMinuteInSeconds, tenMinutesInSeconds } from '../types/constants';
import { CacheService } from '../model/cache.service';

export class InscriptionSimple {
  @ApiProperty() inscriptionId: string;
  @ApiProperty() blockheight: number;
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
  async createHtmlInscriptionOrder(@Body() request: HtmlInscriptionRequest): Promise<OrderResponse> {

    const buff = Buffer.from(request.htmlString);

    // Convert the HTML string to a base64 encoded string
    const contentB64 = buff.toString('base64');
    const size = buff.length;

    const orderResponseFull = await createInscriptionRequestForHtml(
      request.receiveAddress,
      size,
      request.fee,
      contentB64
    );

    // const { id, amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value } = orderResponseFull.charge;
    // const orderResponseShort = {
    //   fee: orderResponseFull.fee,
    //   charge: { id, amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value }
    // }

    return orderResponseFull;
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
  async getOrderStatus(@Param('id') id: string): Promise<OrderResponse> {

    const orderResponseFull = await getOrderStatus(id);

    // const { id, amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value } = orderResponseFull.charge;
    // const orderResponseShort = {
    //   fee: orderResponseFull.fee,
    //   charge: { id, amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value }
    // }

    return orderResponseFull;
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
