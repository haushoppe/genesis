import { ChargeStatus } from "../../ordinalsbot";

/**
 * Get user-friendly message based on the payment status.
 *
 * @param {ChargeStatus} status - The current status of the payment.
 * @returns {string} A meaningful message for the user.
 */
export function getPaymentStatusMessage(status: ChargeStatus | undefined): string {

  switch(status) {
    case ChargeStatus.unpaid:
      return "Your order has been created and we are waiting for your payment.";
    case ChargeStatus.expired:
      return "Your payment session has expired due to inactivity. Please create a new order.";
    case ChargeStatus.processing:
      return "Your payment has been detected and is currently being processed.";
    case ChargeStatus.paid:
      return "Your payment has been received and confirmed. Your order will be processed shortly.";
    case ChargeStatus.underpaid:
      return "Your payment has been detected, but the amount is insufficient. Please send the missing amount to complete the payment, or you may opt to receive a refund. To take further action, please visit the payment processor page.";
    case ChargeStatus.refunded:
      return "Your payment was underpaid, and you've opted for a refund. The funds are on their way back to you.";
    default:
      return "An unexpected error occurred.";
  }
}
