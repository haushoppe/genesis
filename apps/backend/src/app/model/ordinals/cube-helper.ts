import { OrdinalsbotInscriptionSearchResult } from "apps/shared/ordinalsbot-inscription-search-result";
import { InscriptionOrder, OrderResponse } from "../../../../../shared/ordinalsbot-order-response";
import { Attribute } from "../../types/ordinals/attribute";
import { REFERRALS } from './referral-code';


export function hideUnwantedProperties({ charge, files, paid, referral }: OrderResponse): InscriptionOrder {

  const { id, amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value } = charge;

  return {
    id, // id at the root, and not down below charge!
    charge: {
      amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value
    },
    files: files.map(({ completed, dataURL, iqueued, sent, tx }) => ({
      completed,
      dataURL,
      iqueued,
      sent,
      tx
    })),
    paid,
    code: referral === REFERRALS[0].code ? '' : referral
  };
}


/**
 * Parses the given cube HTML string and extracts the attributes.
 *
 * @param {string} cubeHtmlRaw - The raw cube HTML string.
 *
 * @returns {Attribute[]} - An array of attributes containing trait types and their values OR null if its a invalid cube
 */
export function parseCube(cubeHtmlRaw: string): Attribute[] | null {

  const regexIsValid = /^<html><!--cubes\.haushoppe\.art-->/;
  const isValid = regexIsValid.test(cubeHtmlRaw);

  if (!isValid) {
    return null;
  }


  const regexData = /<script>t='([^']*)'<\/script>/;
  const matchData = cubeHtmlRaw.match(regexData);

  if (matchData && matchData[1]) {

    const data = matchData[1].split('|');

    let version = '?';
    if (cubeHtmlRaw.includes('<script src=/content/9475aa8df559d569f7284ce59e97014f28be758e832e212fdbba0202699dd035i0></script>')) {
      version = 'v1';
    }
    if (cubeHtmlRaw.includes('<script src=/content/4c5b32a1bd0dc43b3540097bf0135de6b0389f55fe6fe06910e5393bf6591a42i0></script>')) {
      version = 'v2';
    }
    if (cubeHtmlRaw.includes('<script src=/content/fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0></script>')) {
      version = 'v3';
    }

    let traits = [
      { 'trait_type': 'Side 1', 'value': data[0] },
      { 'trait_type': 'Side 2', 'value': data[1] },
      { 'trait_type': 'Side 3', 'value': data[2] },
      { 'trait_type': 'Side 4', 'value': data[3] },
      { 'trait_type': 'Side 5', 'value': data[4] },
      { 'trait_type': 'Side 6', 'value': data[5] },
      { 'trait_type': 'Version', 'value': version }
    ];

    const regexTitle = /<title>([^<]*)<\/title>/;
    const matchTitle = cubeHtmlRaw.match(regexTitle);

    if (matchTitle && matchTitle[1]) {
      const title = matchTitle[1].replace('&gt;', '>');
      traits = [...traits, { 'trait_type': 'Title', 'value': title }]
    }

    return traits;
  }

  return null;
}


export function searchResultToCubeInscriptionMeta(searchResult: OrdinalsbotInscriptionSearchResult) {

  let meta = searchResult.results

    // filter all out without correct prefex
    .filter(x => x.contentstr.includes('<html><!--cubes.haushoppe.art-->'))

    // get attributes OR null for invalid cubes
    .map(x => {
      const attributes = parseCube(x.contentstr);
      if (attributes) {
        return {
          inscriptionId: x.inscriptionid,
          attributes
        }
      }
      return null;
    })

    // remove invalid cubes
    .filter(x => !!x)

    // assemble Metadata
    .map((x, index) => {

      let name = 'Ordinal Cube #' + index;

      const title = x.attributes.find(t => t.trait_type === 'Title');
      if (title) {
        name = `${ name } (${ title })`
      }

      return {
        inscriptionId: x.inscriptionId,
        meta: {
          name,
          attributes: x.attributes
        }
      };
    }
  );


  return meta;
}
