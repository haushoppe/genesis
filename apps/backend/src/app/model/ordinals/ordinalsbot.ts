import { OrdinalsbotFxrateResult } from '../../../shared/ordinals/ordinalsbot-fxrate-result';
import { ErrorResponse, OrderResponse } from '../../../shared/ordinals/ordinalsbot-order-response';
import { OrdinalsbotPriceRequestParams, OrdinalsbotPriceResult } from '../../../shared/ordinals/ordinalsbot-price-result';
import { REFERRALS } from '../../../shared/ordinals/referral-code';
import { validateReferralCode } from './validate-referral-code';
import { Logger } from '@nestjs/common';


export const INSCRIPTION_REQUESTS_SERVICE_URL = 'https://api.ordinalsbot.com/order';


export async function createInscriptionRequestForHtml(
  receiveAddress: string,
  size: number,
  fee: number,
  contentB64: string,
  code: string
): Promise<OrderResponse> {

  const referral = validateReferralCode(code);
  console.log('Creating order with referral code: ' + referral.code + ' and bonus ' + referral.bonus);

  let order: any = {
    fee,
    files: [
      {
        dataURL: `data:text/html;base64,${contentB64}`,
        name: `cube.html`,
        size,
        type: 'text/html'
      },
    ],
    lowPostage: true,
    receiveAddress,
    referral: referral.code
  };

  if (referral.bonus) {
    order = {
      ...order,
      additionalFee: referral.bonus
    };
  }

  const response = await fetch(INSCRIPTION_REQUESTS_SERVICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    const body = await response.text();
    Logger.error('*** ERROR on createInscriptionRequestForHtml!! ***');
    Logger.error(body);
    throw new Error(`OrdinalsBot order returned ${response.status}: ${body}`);
  }

  return response.json() as Promise<OrderResponse>;
}

export async function saveReferralCode(): Promise<any> {

  return await Promise.all(
    REFERRALS.map(async r => {
      const response = await fetch('https://api.ordinalsbot.com/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referral: r.code, address: r.address }),
      });
      return { [r.code]: await response.json() };
    })
  );
}

export async function getReferralStatus(): Promise<any> {

  return await Promise.all(
    REFERRALS.map(async r => {
      const url = new URL('https://api.ordinalsbot.com/referrals');
      url.searchParams.set('referral', r.code);
      url.searchParams.set('address', r.address);
      const response = await fetch(url);
      return { [r.code]: await response.json() };
    })
  );
}

export async function getOrderStatus(id: string): Promise<OrderResponse | ErrorResponse> {

  const url = new URL('https://api.ordinalsbot.com/order');
  url.searchParams.set('id', id);
  const response = await fetch(url);
  return response.json() as Promise<OrderResponse | ErrorResponse>;
}

/**
 * Fetches the content of a hosted file and converts it into a base64-encoded data URL.
 * Returns '' on any failure (fail silently — caller falls back to the bare URL).
 */
export async function loadHostedContent(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const htmlContent = await response.text();
    if (!htmlContent) return '';
    return 'data:text/html;base64,' + Buffer.from(htmlContent).toString('base64');
  } catch (error) {
    console.error(`Failed to fetch file content from ${url}:`, (error as Error).message);
    return '';
  }
}

export async function getPrice({ fee, size, count, lowPostage }: OrdinalsbotPriceRequestParams): Promise<OrdinalsbotPriceResult> {

  // https://docs.ordinalsbot.com/api/getting-prices/getting-prices-legacy
  const url = new URL('https://api.ordinalsbot.com/price');
  url.searchParams.set('fee', String(fee));
  url.searchParams.set('size', String(size));
  url.searchParams.set('count', String(count));
  url.searchParams.set('lowPostage', String(lowPostage));
  url.searchParams.set('rareSats', 'random');
  url.searchParams.set('type', 'bulk');
  const response = await fetch(url);
  return response.json() as Promise<OrdinalsbotPriceResult>;
}

/**
 * Sourced from our own infrastructure (api.ordpool.space) — the OrdinalsBot
 * /fxrate endpoint started returning HTTP 401 in mid-2026 which made the
 * frontend price block crash with "Cannot read properties of undefined
 * (reading 'usd')". Shape preserved to avoid a caller change.
 */
export async function getFxrate(): Promise<OrdinalsbotFxrateResult> {
  const response = await fetch('https://api.ordpool.space/api/v1/prices');
  const data = await response.json() as { time: number; USD: number; EUR?: number };
  return { bitcoin: { usd: data.USD } };
}
