import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { createInscriptionRequestForHtml } from '../../../../shared/ordinalsbot';
import { OrderResponse } from '../../../../shared/ordinalsbot-order-response';
import { HtmlInscriptionRequest } from '../types/html-inscription-request';


@ApiTags('ordinals')
@Controller()
export class OrdinalsController {

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
}
