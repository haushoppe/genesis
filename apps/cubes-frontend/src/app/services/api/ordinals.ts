/* eslint-disable @typescript-eslint/no-non-null-assertion */
import axios from 'axios';

import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';
import { INSCRIPTION_REQUESTS_SERVICE_URL, ORDINALS_URL, XVERSE_API_BASE_URL } from '../constant';
import { BtcOrdinal, InscriptionRequestResponse, InscriptionRequestResponseAndFeesResponse, NetworkType, UTXO } from '../types';

export function parseOrdinalTextContentData(content: string): string {
  try {
    const contentData = JSON.parse(content);
    if (contentData.p) {
      // check for sns protocol
      if (contentData.p === 'sns') {
        // eslint-disable-next-line no-prototype-builtins
        return contentData.hasOwnProperty('name') ? contentData.name : content;
      } else {
        return content;
      }
    } else {
      return content;
    }
  } catch (error) {
    return content;
  }
}

const sortOrdinalsByConfirmationTime = (prev: BtcOrdinal, next: BtcOrdinal) => {
  if (prev.confirmationTime > next.confirmationTime) {
    return 1;
  }
  if (prev.confirmationTime < next.confirmationTime) {
    return -1;
  }
  return 0;
};

export async function fetchBtcOrdinalsData(
  btcAddress: string,
  network: NetworkType
): Promise<BtcOrdinal[]> {
  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const unspentUTXOS = await btcClient.getUnspentUtxos(btcAddress);
  const ordinals: BtcOrdinal[] = [];
  await Promise.all(
    unspentUTXOS.map(async (utxo: UTXO) => {
      const ordinalContentUrl = `${XVERSE_API_BASE_URL}/v1/ordinals/output/${utxo.txid}/${utxo.vout}`;
      try {
        const ordinal = await axios.get(ordinalContentUrl);
        if (ordinal) {
          ordinals.push({
            id: ordinal.data.id,
            confirmationTime: utxo.status.block_time || 0,
            utxo,
          });
        }
        return await Promise.resolve(ordinal);
      } catch (err) {
        return Promise.reject(err);
      }
    })
  );
  return ordinals.sort(sortOrdinalsByConfirmationTime);
}

export async function getOrdinalIdFromUtxo(utxo: UTXO) {
  const ordinalContentUrl = `${XVERSE_API_BASE_URL}/v1/ordinals/output/${utxo.txid}/${utxo.vout}`;
  try {
    const ordinal = await axios.get(ordinalContentUrl);
    if (ordinal) {
      if (ordinal.data.id) {
        return await Promise.resolve(ordinal.data.id);
      } else {
        return null;
      }
    } else {
      return null;
    }
  } catch (err) {
    void(0);
  }
}

export async function getTextOrdinalContent(inscriptionId: string): Promise<string> {
  const url = ORDINALS_URL(inscriptionId);
  return axios
    .get<string>(url, {
      timeout: 30000,
      transformResponse: [(data) => parseOrdinalTextContentData(data)],
    })
    .then((response) => response!.data)
    .catch((error) => {
      return '';
    });
}

export async function getNonOrdinalUtxo(
  address: string,
  network: NetworkType,
): Promise<Array<UTXO>> {
  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const unspentOutputs = await btcClient.getUnspentUtxos(address);
  const nonOrdinalOutputs: Array<UTXO> = []

  for (let i = 0; i < unspentOutputs.length; i++) {
    const ordinalId = await getOrdinalIdFromUtxo(unspentOutputs[i]);
    if (ordinalId) {
      void(0);
    } else {
      nonOrdinalOutputs.push(unspentOutputs[i]);
    }
  }

  return nonOrdinalOutputs;
}

export async function createInscriptionRequestForHtml(
  receiveAddress: string,
  size: number,
  totalFeeSats: number,
  contentB64: string,
): Promise<InscriptionRequestResponse> {

  const additionalFee = 35000; // 35000 satashis round about 10 USD if BTC 1 = $28,916.07

  const response = await axios.post(INSCRIPTION_REQUESTS_SERVICE_URL, {
    fee: totalFeeSats,
    files: [
      {
        dataURL: `data:text/html;base64,${contentB64}`,
        name: `cube.html`,
        size: size,
        type: 'text/html;charset=utf-8',
        url: '',
      },
    ],
    lowPostage: true,
    receiveAddress,
    referral: 'HAUSHOPPE',
    additionalFee
  });
  return response.data;
}

export const createHtmlInscriptionOrder = async (
  receiveAddress: string,
  htmlString: string
): Promise<InscriptionRequestResponseAndFeesResponse> => {

  // Convert the HTML string to a base64 encoded string
  const contentB64 = btoa(unescape(encodeURIComponent(htmlString)));

  // instead of Buffer.from(htmlString).length which does not work in the browser
  const size = new Blob([htmlString]).size;

  const btcClient = new BitcoinEsploraApiProvider({
    network: 'Mainnet',
  });

  const feesResponse = await btcClient.getRecommendedFees();
  const inscriptionRequest = await createInscriptionRequestForHtml(
    receiveAddress,
    size,
    feesResponse.fastestFee,
    contentB64
  );

  return {
    inscriptionRequest,
    feesResponse
  };
};
