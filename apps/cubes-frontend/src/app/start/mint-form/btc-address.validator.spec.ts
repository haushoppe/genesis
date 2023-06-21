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

  it('should validate Bech32 with a length of 3+25 chars address correctly', () => {
    const control = new FormControl('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
    expect(BtcAddressValidator()(control)).toBeNull();
  });

  it('should validate a very long Bech32 address correctly', () => {
    const control = new FormControl('???');
    expect(BtcAddressValidator()(control)).toBeNull();
  });

  it('shoud reject P2PKH address without correct checksum', () => {
    const control = new FormControl('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN');
    expect(BtcAddressValidator()(control)).toEqual({ 'invalidBtcAddress': { value: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN' } });
  });

  it('should reject a completely invalid address', () => {
    const control = new FormControl('1BvBMSEYs');
    expect(BtcAddressValidator()(control)).toEqual({ 'invalidBtcAddress': { value: '1BvBMSEYs' } });
  });
});
