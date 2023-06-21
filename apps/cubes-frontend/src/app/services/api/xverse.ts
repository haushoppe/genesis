import axios from 'axios';
import BigNumber from 'bignumber.js';

import { API_TIMEOUT_MILLI, XVERSE_API_BASE_URL } from '../constant';
import { BtcFeeResponse, OrdinalInfo, SupportedCurrency } from '../types';
import { fetchBtcOrdinalsData } from './ordinals';

export async function fetchBtcFeeRate(): Promise<BtcFeeResponse> {
  return axios
    .get(`${XVERSE_API_BASE_URL}/v1/fees/btc`, {
      method: 'GET',
    })
    .then((response) => {
      return response.data;
    });
}

export async function fetchBtcToCurrencyRate({
  fiatCurrency,
}: {
  fiatCurrency: SupportedCurrency;
}): Promise<BigNumber> {
  return axios
    .get(`${XVERSE_API_BASE_URL}/v1/prices/btc/${fiatCurrency}`, { timeout: API_TIMEOUT_MILLI })
    .then((response) => {
     return new BigNumber(response.data.btcFiatRate.toString());
    });
}

export async function getOrdinalsByAddress(ordinalsAddress: string) {
  return fetchBtcOrdinalsData(ordinalsAddress, 'Mainnet');
}

export async function getOrdinalInfo(ordinalId: string): Promise<OrdinalInfo> {
  const ordinalInfoUrl = `${XVERSE_API_BASE_URL}/v1/ordinals/${ordinalId}`;
  const ordinalInfo = await axios.get(ordinalInfoUrl);
  return ordinalInfo.data;
}
