/**
 * Enumeration of OpenNode bitcoin payment statuses.
 *
 * see https://developers.opennode.com/docs/charge-lifecycle
 * @property {string} unpaid - The initial status once a charge is created.
 * @property {string} expired - The status when 24 hours pass without any activity on the charge.
 * @property {string} processing - The status when an on-chain payment is detected but not yet confirmed (0 confirmations).
 * @property {string} paid - The status when a Lightning payment is received and confirmed, or when an on-chain payment is received and confirmed (1+ confirmations). This status credits the user's account with the received funds.
 * @property {string} underpaid - The status when an on-chain payment is received but the amount is insufficient to pay the charge. The user can either opt to receive the funds back or complete the payment by sending the missing BTC amount.
 * @property {string} refunded - The status when an on-chain payment is received but underpaid, and the payer opts to receive their funds back.
 */
export enum ChargeStatus
{
  unpaid = 'unpaid',
  expired = 'expired',
  processing = 'processing',
  paid = 'paid',
  underpaid = 'underpaid',
  refunded = 'refunded'
}

