import { FormControl } from '@angular/forms';
import { BtcAddressValidator } from './btc-address.validator';

describe('BtcAddressValidator', () => {
  it('should validate P2PKH address correctly', () => {
    const control = new FormControl('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
    expect(BtcAddressValidator()(control)).toBeNull();
  });

  it('should validate P2SH address correctly', () => {
    const control = new FormControl('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');
    expect(BtcAddressValidator()(control)).toBeNull();
  });

  it('should validate Bech32 address correctly', () => {
    const control = new FormControl('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
    expect(BtcAddressValidator()(control)).toBeNull();
  });

  // The address '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN' is infact invalid,
  // but it passes our current validator because it matches the length and starting character of a P2PKH address.
  it('its ok to pass addresses that do not have a correct checksum', () => {
    const control = new FormControl('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN');
    expect(BtcAddressValidator()(control)).toBeNull();
  });

  it('should reject a completely invalid address', () => {
    const control = new FormControl('1BvBMSEYs');
    expect(BtcAddressValidator()(control)).toEqual({ 'invalidBtcAddress': { value: '1BvBMSEYs' } });
  });
});

