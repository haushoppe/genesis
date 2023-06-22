import axios from 'axios';
import { OrderResponse } from './ordinalsbot-order-response';

export const REFERRAL_CODE = 'HAUS_HOPPE_CUBE_35000';
export const REFERRAL_ADDRESS = '???';
export const REFERRAL_ADDITIONAL_FEE = 35000; // 35000 satashis round about 10 USD if BTC 1 = $28,916.07

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
): Promise<OrderResponse> {

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
    referral: REFERRAL_CODE,
    additionalFee: REFERRAL_ADDITIONAL_FEE
  });
  return response.data;
}

export async function saveReferralCode(): Promise<any> {

  const response = await axios.post('https://ordinalsbot.com/api/referrals', {
    referral: REFERRAL_CODE,
    address: REFERRAL_ADDRESS

  });
  return response.data;
}

export async function getReferralStatus(): Promise<any> {

  const response = await axios.get('https://ordinalsbot.com/api/referrals',
  {
    params: {
      referral: REFERRAL_CODE,
      address: REFERRAL_ADDRESS
    }
  });
  return response.data;
}
