import axios from 'axios';
import { OrderResponse } from './ordinalsbot-order-response';
import { OrdinalsbotInscriptionSearchResult } from './ordinalsbot-inscription-search-result';
import { validateCode } from './validate-code';
import { REFERRALS } from './referrals';

export const INSCRIPTION_REQUESTS_SERVICE_URL = 'https://api2.ordinalsbot.com/order';
// export const INSCRIPTION_REQUESTS_SERVICE_URL = 'https://signet.ordinalsbot.com/api/order'

production: false

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

  const referal = validateCode(code);

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
    referral: referal.code,
    additionalFee: referal.bonus
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
