import { AbstractControl, ValidatorFn } from '@angular/forms';
import { validate } from 'bitcoin-address-validation';


/**
 * @description
 * Validator that performs Bitcoin address validation. Returns the validation result after performing the check.
 *
 * The validator supports the following types of Bitcoin addresses:
 * 1. P2PKH (Pay to Public Key Hash) - addresses start with a '1'
 * 2. P2SH (Pay to Script Hash) - addresses start with a '3'
 * 3. Bech32 (native segwit) - addresses start with 'bc1'
 *
 * @returns A validator function that returns an error map with the 'invalidBtcAddress' property  if the validation check fails, and null otherwise.
 */
export function BtcAddressValidator(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: { value: string } } | null => {
    const address = control.value;
    return validate(address) ? null : { 'invalidBtcAddress': { value: control.value } };
  };
}
