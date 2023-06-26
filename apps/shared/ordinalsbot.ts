import axios from 'axios';
import { OrderResponse } from './ordinalsbot-order-response';
import { OrdinalsbotInscriptionSearchResult } from './ordinalsbot-inscription-search-result';
import { OrdinalsbotPriceRequestParams, OrdinalsbotPriceResult } from './ordinalsbot-price-result';
import { OrdinalsbotFxrateResult } from './ordinalsbot-fxrate-result';

import { validateCode } from './validate-code';
import { REFERRALS } from './referrals';

export const INSCRIPTION_REQUESTS_SERVICE_URL = 'https://api2.ordinalsbot.com/order';
// export const INSCRIPTION_REQUESTS_SERVICE_URL = 'https://signet.ordinalsbot.com/api/order'

/*

EXAMPLE of sending test.html with the content
<html>Hello World!
(18 characters)

REQUEST
{
   "files":[
      {
         "size":18,
         "type":"text/html",
         "name":"test.html",
         "dataURL":"data:text/html;base64,PGh0bWw+SGVsbG8gV29ybGQh",
         "url":""
      }
   ],
   "lowPostage":false,
   "receiveAddress":"",
   "rareSats":"random",
   "fee":27,
   "referral":"your-referral-code"
}
*/


export async function createInscriptionRequestForHtml(
  receiveAddress: string,
  size: number,
  fee: number,
  contentB64: string,
  code: string
): Promise<OrderResponse> {

  const referral = validateCode(code);
  console.log('Creating order with referral code: ' + referral.code + ' and bonus ' + referral.bonus);

  const response = await axios.post(INSCRIPTION_REQUESTS_SERVICE_URL, {
    fee,
    files: [
      {
        dataURL: `data:text/html;base64,${contentB64}`,
        name: `cube.html`,
        size,
        type: 'text/html',
        url: '',
      },
    ],
    lowPostage: true,
    receiveAddress,
    referral: referral.code,
    additionalFee: referral.bonus
  });
  return response.data;
}

export async function saveReferralCode(): Promise<any> {

  return await Promise.all(
    REFERRALS.map(async r => {
      const response = await axios.post('https://ordinalsbot.com/api/referrals', {
        referral: r.code,
        address: r.address
      });

      return { [r.code]: response.data }
    })
  );
}

export async function getReferralStatus(): Promise<any> {

  return await Promise.all(
    REFERRALS.map(async r => {
      const response = await axios.get('https://ordinalsbot.com/api/referrals', {
        params: {
          referral: r.code,
          address: r.address
        }
      });

      return { [r.code]: response.data }
    })
  );
}

export async function getOrderStatus(id: string): Promise<OrderResponse> {

  const response = await axios.get('https://api2.ordinalsbot.com/order',
    {
      params: {
        id
      }
    });
  return response.data;
}

export async function searchForText(text: string): Promise<OrdinalsbotInscriptionSearchResult> {

  const response = await axios.get('https://api2.ordinalsbot.com/search',
    {
      params: {
        text
      }
    });
  return response.data;
}

export async function getPrice({ fee, size, count, lowPostage }: OrdinalsbotPriceRequestParams): Promise<OrdinalsbotPriceResult> {

  const response = await axios.get('https://ordinalsbot.com/api/price',
    {
      params: { fee, size, count, lowPostage }
    });

  return response.data;
}

export async function getFxrate(): Promise<OrdinalsbotFxrateResult> {

  const response = await axios.get('https://ordinalsbot.com/api/fxrate',
    {
      params: {
        ids: 'bitcoin',
        vs_currencies: 'usd'
      }
    });

  return response.data;
}
