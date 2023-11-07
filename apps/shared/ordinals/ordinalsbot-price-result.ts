
/*
  RESPONSE of GET https://ordinalsbot.com/api/price?fee=60&size=557&count=1&lowPostage=true&rareSats=random

  {
    "status": "ok",
    "chainFee": 26355,
    "baseFee": 15546,
    "serviceFee": 17390,
    "totalFee": 43745,
    "count": "1"
}
*/

export interface OrdinalsbotPriceResult {
  status: string;
  chainFee: number;
  baseFee: number;
  serviceFee: number;
  totalFee: number;
  count: 1
}

export interface OrdinalsbotPriceRequestParams {
  fee: number;
  size: number;
  count: 1;
  lowPostage: 'true' | 'false'
}
