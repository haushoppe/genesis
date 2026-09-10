import { formatSats as groupSats } from 'ordpool-sdk';

/**
 * Format a sat amount with an optional USD equivalent.
 *
 * The sat count is grouped by the SDK's `formatSats` (space-separated, the
 * Bitcoin-amount grouping the ordpool family shares) so the number renders the
 * same here as on cat21.space and ordpool.space. The ` sat` unit and the USD
 * suffix are display concerns the SDK leaves to the consumer, so they stay here.
 *
 * Examples (usdPerBtc = 65000):
 *   formatSats(3000, 65000)      → '3 000 sat (~$1.95)'
 *   formatSats(0, 65000)         → '0 sat ($0.00)'
 *   formatSats(50, 65000)        → '50 sat (<$0.01)'
 *   formatSats(3000, null)       → '3 000 sat'
 *   formatSats(100_000_000, 100_000) → '100 000 000 sat (~$100,000.00)'
 */
export function formatSats(sats: number, usdPerBtc: number | null): string {
  const satStr = `${groupSats(sats)} sat`;
  if (usdPerBtc == null) return satStr;
  const dollarValue = (sats / 1e8) * usdPerBtc;
  // Zero must render as `$0.00` (a real, honest amount); only 0 <
  // value < 0.01 is the "less than a cent" bucket that would round
  // to $0.00 and mislead the user.
  let dollarStr: string;
  if (dollarValue === 0) {
    dollarStr = '$0.00';
  } else if (dollarValue > 0 && dollarValue < 0.01) {
    dollarStr = '<$0.01';
  } else {
    dollarStr = `~$${dollarValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${satStr} (${dollarStr})`;
}
