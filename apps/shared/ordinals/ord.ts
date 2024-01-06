import axios from 'axios';

const cheerio = require('cheerio');

interface ParsedInscriptionData {
  inscriptionId: string;
  prevInscriptionId: string | null;
  nextInscriptionId: string | null;
  inscriptionNumber: number;
  address: string;
  outputValue: number;
  satNumber: string;
  contentLength: number;
  contentType: string;
  timestamp: string;
  genesisHeight: number;
  genesisFee: number;
  genesisTransactionId: string;
  output: string;
  offset: number;
  ethereumTeleburnAddress: string;
}

// see https://github.com/ordinals/ord/blob/e39031a46531696e5dd0c853146f8bfab5b7582c/templates/inscription.html
function parseInscriptionHtmlPage(html: string): ParsedInscriptionData {

    const $ = cheerio.load(html);

    // Function to get the next sibling text based on the dt tag text
    const getValue = (dtText: string) => $(`dt:contains('${dtText}') + dd`).text().trim();
    const getNumberValue = (dtText: string) => parseInt(getValue(dtText))

    return {
      // Extracting the Inscription number from the <h1> tag
      inscriptionNumber: parseInt($('h1').text().trim().replace('Inscription ', '')),

      // Extracting further data
      prevInscriptionId: $('a.prev').attr('href').split('/').pop(),
      nextInscriptionId: $('a.next').attr('href').split('/').pop(),
      inscriptionId: getValue('id'),
      address: getValue('address'),
      outputValue: getNumberValue('output value'),
      satNumber: getValue('sat'),
      contentLength: parseInt(getValue('content length').replace(' bytes', '')),
      contentType: getValue('content type'),
      timestamp: getValue('timestamp'),
      genesisHeight: getNumberValue('genesis height'),
      genesisFee: getNumberValue('genesis fee'),
      genesisTransactionId: getValue('genesis transaction'),
      output: getValue('output'),
      offset: getNumberValue('offset'),
      ethereumTeleburnAddress: getValue('ethereum teleburn address'),
    }
}




/**
 * Fetches the inscription data for the given id from the ordinals.com API.
 *
 *
 * @param id - The inscription ID
 * @returns A promise that resolves to the inscription data.
 */
export async function getInscriptionFromOrd(id: string): Promise<any> {

  const response = await axios.get(`https://explorer.ordinalsbot.com/inscription/${id}`, {
    headers: {
      // 'Accept': 'application/json'
    }});

    return parseInscriptionHtmlPage(response.data);
}
