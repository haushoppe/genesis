import { OrdinalsbotInscriptionSearchResult } from 'apps/shared/ordinalsbot-inscription-search-result';

import { InscriptionOrder, OrderResponse } from '../../../../../shared/ordinalsbot-order-response';
import { parseCube } from '../../../../../shared/parse-cube';
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
      dataURL, // warning! this could contain malicious HTML! parse it!
      iqueued,
      sent,
      tx
    })),
    paid,
    code: referral === REFERRALS[0].code ? '' : referral
  };
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
      console.log('Invalid cube! ' +  x.inscriptionid);
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
