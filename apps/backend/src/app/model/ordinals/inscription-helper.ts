import { LooksLikeOrdinalsbotInscription } from '../../../../../shared/ordinals/ordinalnovus-inscription-search-result';
import { InscriptionOrder, OrderResponse } from '../../../../../shared/ordinals/ordinalsbot-order-response';
import { InscriptionExtended } from '../../types/ordinals/inscription-extended';


export function hideUnwantedProperties({ id, charge, files, paid, referral }: OrderResponse): InscriptionOrder {

  const { amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value } = charge;

  return {
    id,
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
export function collectClaimedInscriptionIds(data: InscriptionExtended[]) {

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

/**
 * Sorts an array of LooksLikeOrdinalsbotInscription objects.
 * The primary sort key is the blockheight, and the secondary sort key (when blockheights are equal) is inscriptionnumber.
 *
 * @param {LooksLikeOrdinalsbotInscription[]} inscriptions - The array of inscriptions to sort.
 * @returns {LooksLikeOrdinalsbotInscription[]} - The sorted array of inscriptions.
 */
export function sortInscriptions(inscriptions: LooksLikeOrdinalsbotInscription[]): LooksLikeOrdinalsbotInscription[] {
  return inscriptions.sort((a, b) => {
    // Sort by blockheight
    if (a.blockheight !== b.blockheight) {
      return a.blockheight - b.blockheight;
    }
    // If blockheights are equal, sort by inscriptionnumber
    return a.inscriptionnumber - b.inscriptionnumber;
  });
}

/**
 * Finds an item by inscriptionId in an array and returns the item, as well as the previous and next items.
 *
 * @param {Array<{ inscriptionId: number; [key: string]: any }>} array - The array of items with an 'inscriptionId' property.
 * @param {string} inscriptionId - The inscriptionId of the item to find.
 * @returns {{ previous: T | null; current: T | null; next: T | null }} - An object with the previous, current, and next items.
 * @template T - The type of the array elements.
 */
export function findItemByInscriptionId<T extends { inscriptionId: string }>(
  array: T[],
  inscriptionId: string
): { previous: T | null; current: T | null; next: T | null } {
  const index = array.findIndex(item => item.inscriptionId === inscriptionId);

  if (index === -1) {
    return { previous: null, current: null, next: null };
  }

  const previous = index > 0 ? array[index - 1] : null;
  const current = array[index];
  const next = index < array.length - 1 ? array[index + 1] : null;

  return { previous, current, next };
}
