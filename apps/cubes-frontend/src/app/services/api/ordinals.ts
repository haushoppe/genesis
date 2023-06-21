/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  NetworkType,
  BtcOrdinal,
  UTXO,
  FungibleToken,
  InscriptionRequestResponse,
  Inscription
} from '../types';
import axios from 'axios';
import {
  ORDINALS_URL,
  XVERSE_API_BASE_URL,
  INSCRIPTION_REQUESTS_SERVICE_URL
} from '../constant';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';

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
      } catch (err) {}
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
  } catch (err) {}
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
  additionalFee: number,
  fileBase64: string,
): Promise<InscriptionRequestResponse> {
  const response = await axios.post(INSCRIPTION_REQUESTS_SERVICE_URL, {
    fee: totalFeeSats,
    files: [
      {
        dataURL: `data:text/html;base64,${fileBase64}`,
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

export const isBrcTransferValid = (inscription: Inscription) => inscription.address === inscription.genesis_address
