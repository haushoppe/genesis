/**
 * Format a sat amount with an optional USD equivalent.
 *
 * Examples (usdPerBtc = 65000):
 *   formatSats(3000, 65000)  → '3,000 sat (~$1.95)'
 *   formatSats(3000, null)   → '3,000 sat'
 *   formatSats(50, 65000)    → '50 sat (<$0.01)'
 */
export function formatSats(sats: number, usdPerBtc: number | null): string {
  const satStr = `${sats.toLocaleString('en-US')} sat`;
  if (usdPerBtc == null) return satStr;
  const dollarValue = (sats / 1e8) * usdPerBtc;
  const dollarStr = dollarValue < 0.01 ? '<$0.01' : `~$${dollarValue.toFixed(2)}`;
  return `${satStr} (${dollarStr})`;
}
