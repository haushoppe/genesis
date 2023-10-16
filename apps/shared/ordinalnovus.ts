import axios from 'axios';
import { OrdinalnovusInscription, OrdinalnovusInscriptionSearchResult, LooksLikeOrdinalsbotInscription } from './ordinalnovus-inscription-search-result'

const apiHost = 'https://api.ordinalnovus.com/api';

// const apiKey = '85b1f7f4-3099-4cf7-8e38-8d3ba494a3ad'; // golden example API key
const apiKey = '0bf2eced-5ab2-4595-b353-41de8d2627d6';

export async function apikeyCreate(wallet: string): Promise<{
  message: string,
  apiKey: string
}> {

  const response = await axios.post(`${apiHost}/apikey/create`, { wallet });
  return response.data;
}

export async function getApikeyDetails(): Promise<{
  success: boolean,
  usage: number,
  userType: string,
  rateLimit: number,
  expirationDate: string
}> {

  const response = await axios.get(`${apiHost}/apikey/${apiKey}`)
  return response.data;
}

export async function ordinalnovusSearchForText(text: string): Promise<LooksLikeOrdinalsbotInscription[]> {

  const limit = 100;
  let start = 0;
  let allInscriptions: LooksLikeOrdinalsbotInscription[] = [];


  while (true) {
    const response: { data: OrdinalnovusInscriptionSearchResult } = await axios.get(`${apiHost}/inscription`,
      {
        params: {
          apiKey,
          content: text,
          content_type: 'text/html;charset=utf-8',
          match: 'regex',
          // possible params
          // apiKey (required), sha, inscriptionId, content_type, _id, officialCollection, sat, sat_name, rarity, block, content, content_type, sat_offset, number, show, _limit, _start, _sort
          show: 'inscriptionId,number,content',
          _limit: limit,
          _start: start
        }
      });

    if (response.data.inscriptions.length === 0) {
      break;  // No more data to fetch
    }

    const mapped: LooksLikeOrdinalsbotInscription[] = response.data.inscriptions.map(({
      inscriptionId,
      number,
      content
    }) => ({
      inscriptionid: inscriptionId,
      inscriptionnumber: number,
      contentstr: content
    }));

    allInscriptions = allInscriptions.concat(mapped);

    // Check if we fetched fewer inscriptions than the limit, meaning it's the last page
    if (response.data.inscriptions.length < limit) {
      break;
    }

    start += limit;  // Move to the next page
  }

  return allInscriptions;
}

