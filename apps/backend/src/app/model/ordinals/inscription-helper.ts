import { InscriptionOrder, OrderResponse } from '../../../../../shared/ordinals/ordinalsbot-order-response';
import { InscriptionExtended } from '../../types/ordinals/inscription-extended';

export function hideUnwantedProperties(orderResponse: OrderResponse): InscriptionOrder {

  const { id, charge, files, paid } = orderResponse;
  const { amount, hosted_checkout_url, chain_invoice, lightning_invoice, fiat_value } = charge;

  return {
    id, // warning: can be undefined!
    charge: {
      amount,
      hosted_checkout_url,
      chain_invoice,
      lightning_invoice,
      fiat_value
    },
    files: files.map(({ completed, dataURL, url, iqueued, sent, tx }) => ({
      completed,
      dataURL,
      url,
      iqueued,
      sent,
      tx
    })),
    paid
  };
}

/**
 * Collects all IDs based on specified trait types from a given data array.
 *
 * @param data - The array containing the data.
 * @returns An array of IDs corresponding to the specified trait types.
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
 * Finds an item by inscriptionId in an array and returns the item, as well as the previous and next items.
 *
 * @param array - The array of items with an 'inscriptionId' property.
 * @param inscriptionId - The inscriptionId of the item to find.
 * @returns An object with the previous, current, and next items.
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
