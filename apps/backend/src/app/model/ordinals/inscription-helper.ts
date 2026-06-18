import { InscriptionOrder, OrderResponse } from '../../../../../shared/ordinals/ordinalsbot-order-response';

/**
 * Project an OrdinalsBot OrderResponse down to the public-facing fields
 * we expose to the cubes-frontend. Strips internal/sensitive properties.
 */
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
