import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';

import { createInscriptionRequestForHtml, getReferralStatus, saveReferralCode } from '../../../../shared/ordinalsbot';
import { OrderResponse } from '../../../../shared/ordinalsbot-order-response';
import { HtmlInscriptionRequest } from '../types/html-inscription-request';


@ApiTags('ordinals')
@Controller()
export class OrdinalsController {

  constructor(private configService: ConfigService) { }

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
