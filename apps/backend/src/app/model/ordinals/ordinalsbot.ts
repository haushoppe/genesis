import axios from 'axios';

import { OrdinalsbotFxrateResult } from '../../../../../shared/ordinalsbot-fxrate-result';
import { OrdinalsbotInscriptionSearchResult } from '../../../../../shared/ordinalsbot-inscription-search-result';
import { ErrorResponse, OrderResponse } from '../../../../../shared/ordinalsbot-order-response';
import { OrdinalsbotPriceRequestParams, OrdinalsbotPriceResult } from '../../../../../shared/ordinalsbot-price-result';
import { REFERRALS } from '../../../../../shared/referral-code';
import { validateReferralCode } from './validate-referral-code';

export const INSCRIPTION_REQUESTS_SERVICE_URL = 'https://api.ordinalsbot.com/order';
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

  const referral = validateReferralCode(code);
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

export async function getOrderStatus(id: string): Promise<OrderResponse | ErrorResponse> {

  const response = await axios.get('https://api.ordinalsbot.com/order',
    {
      params: {
        id
      }
    });
  return response.data;
}

export async function searchForText(text: string): Promise<OrdinalsbotInscriptionSearchResult> {

  const response = await axios.get('https://api.ordinalsbot.com/search',
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

/*
GET https://ordinalsbot.com/api/inventory

Example reponse!
Pizza is out of stock! :-/

{
    "2009": {
        "amount": 10459597,
        "baseFee": 50000,
        "count": 43,
        "maxSize": 4812114,
        "minSize": 526
    },
    "2010": {
        "amount": 10234765,
        "baseFee": 30000,
        "count": 132,
        "maxSize": 616822,
        "minSize": 516
    },
    "2011": {
        "amount": 19707330,
        "baseFee": 20000,
        "count": 195,
        "maxSize": 998200,
        "minSize": 753
    },
    "btcmachines_glam": {
        "amount": 2766727,
        "baseFee": 178787,
        "count": 4,
        "maxSize": 920606,
        "minSize": 4909
    },
    "pizza": {
        "amount": 0,
        "baseFee": 25000,
        "count": 0,
        "maxSize": 0,
        "minSize": 100000000
    },
    "rare_1": {
        "amount": 125087769,
        "baseFee": 3000000,
        "count": 5,
        "maxSize": 5000000,
        "minSize": 9500
    },
    "updatedAt": 1688284178475
}

//
switch (e) {
  case "2009":
    return "2009";
case "2010":
    return "2010";
case "2011":
    return "2011";
case "pizza":
    return "pizza";
case "btcmachines_glam":
    return "block78";
case "rare_1":
    return "uncommon";
default:
    return "random"
}

*/
