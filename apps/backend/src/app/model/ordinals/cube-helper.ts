import { InscriptionOrder, OrderResponse } from '../../../../../shared/ordinalsbot-order-response';
import { InscriptionSimple } from '../../types/ordinals/inscription-simple';


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
    paid
    // code: referral === REFERRALS[0].code ? '' : referral
  };
}

/**
 * Collects all IDs based on specified trait types from a given data array.
 *
 * @param {Array} data - The array containing the data.
 * @returns {Array} An array of IDs corresponding to the specified trait types.
 */
export function collectClaimedInscriptionIds(data: InscriptionSimple[]) {

  const traitTypes = ['Side 1', 'Side 2', 'Side 3', 'Side 4', 'Side 5', 'Side 6'];
  const ids = [];

  for (const entry of data) {
    for (const attribute of entry.meta.attributes) {
      if (traitTypes.includes(attribute.trait_type)) {
        ids.push(attribute.value);
      }
    }
  }

  return ids;
}
