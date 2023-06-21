import { ChargeStatus } from "../../ordinalsbot";

/**
 * Check if a payment is pending.
 *
 * @param {ChargeStatus} status - The current status of the payment.
 * @returns {boolean} Returns true if the payment is unpaid or processing.
 */
export function getPaymentPending(status: ChargeStatus | undefined): boolean {
  return status === ChargeStatus.unpaid || status === ChargeStatus.processing;
}
