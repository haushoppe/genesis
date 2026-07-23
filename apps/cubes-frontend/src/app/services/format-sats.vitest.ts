import { describe, expect, it } from 'vitest';

import { formatSats } from './format-sats';

describe('formatSats', () => {
  it('formats sats without USD when price is null', () => {
    expect(formatSats(3000, null)).toBe('3,000 sat');
    expect(formatSats(0, null)).toBe('0 sat');
    expect(formatSats(1_234_567, null)).toBe('1,234,567 sat');
  });

  it('appends USD equivalent when price is provided', () => {
    // At 65000 USD/BTC, 3000 sat = 0.00003 BTC = 1.95 USD
    expect(formatSats(3000, 65000)).toBe('3,000 sat (~$1.95)');
    // 546 sat postage at 65000 = 0.3549 USD → 0.35
    expect(formatSats(546, 65000)).toBe('546 sat (~$0.35)');
  });

  it('shows <$0.01 only for strictly-positive sub-cent amounts', () => {
    // 10 sat at 65000 = 0.0065 USD → below cent
    expect(formatSats(10, 65000)).toBe('10 sat (<$0.01)');
  });

  it('renders zero as $0.00, not <$0.01', () => {
    expect(formatSats(0, 65000)).toBe('0 sat ($0.00)');
  });

  it('groups thousand separators in the USD amount', () => {
    // 1 BTC at 100k USD/BTC = 100,000
    expect(formatSats(100_000_000, 100_000)).toBe('100,000,000 sat (~$100,000.00)');
    // 10k sats at 65000 = 6.50 USD
    expect(formatSats(10_000, 65000)).toBe('10,000 sat (~$6.50)');
  });
});
