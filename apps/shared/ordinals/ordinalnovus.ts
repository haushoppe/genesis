import axios from 'axios';
import { OrdinalnovusInscriptionSearchResult, LooksLikeOrdinalsbotInscription } from './ordinalnovus-inscription-search-result'

const apiHost = 'https://ordinalnovus.com/api/v2';

// const apiKey = '85b1f7f4-3099-4cf7-8e38-8d3ba494a3ad'; // golden example API key from the docs

export async function ordinalnovusSearchForText(searchText: string, apiKey: string): Promise<LooksLikeOrdinalsbotInscription[]> {

  const limit = 1000;
  let start = 0;
  let allInscriptions: LooksLikeOrdinalsbotInscription[] = [];


  while (true) {
    const response: { data: OrdinalnovusInscriptionSearchResult } = await axios.get(`${apiHost}/inscription`,
      {
        params: {
          show: 'inscription_id,inscription_number,content,block',
          match: 'regex',
          content: searchText,
          _limit: limit,
          _start: start,
          apikey: apiKey
        }
      });

    if (response.data.inscriptions.length === 0) {
      break;  // No more data to fetch
    }

    console.log(response);


    const mapped: LooksLikeOrdinalsbotInscription[] = response.data.inscriptions.map(({
      inscription_id,
      inscription_number,
      content,
      block
    }) => ({
      inscriptionid: inscription_id,
      inscriptionnumber: inscription_number,
      contentstr: content,
      blockheight: block
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

