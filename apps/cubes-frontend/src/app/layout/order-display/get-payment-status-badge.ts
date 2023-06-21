import { ChargeStatus } from "../../ordinalsbot";

/**
 * Get corresponding Bootstrap badge class based on the payment status.
 *
 * @param {ChargeStatus} status - The current status of the payment.
 * @returns {string} The corresponding Bootstrap badge class.
 */
export function getPaymentStatusBadge(status: ChargeStatus | undefined): string {
  switch(status) {
    case ChargeStatus.unpaid:
      return "bg-warning text-dark"; // Yellow badge, payment pending
    case ChargeStatus.expired:
      return "bg-secondary"; // Grey badge, expired payment
    case ChargeStatus.processing:
      return "bg-info text-dark"; // Cyan badge, payment processing
    case ChargeStatus.paid:
      return "bg-success"; // Green badge, payment successful
    case ChargeStatus.underpaid:
      return "bg-danger"; // Red badge, payment insufficient
    case ChargeStatus.refunded:
      return "bg-primary"; // Blue badge, refunded payment
    default:
      return "bg-secondary"; // Grey badge, unrecognized status
  }
}
