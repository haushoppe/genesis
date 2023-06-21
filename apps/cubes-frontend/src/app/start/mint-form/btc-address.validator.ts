import { AbstractControl, ValidatorFn } from '@angular/forms';

/**
 * @description
 * Validator that performs a SIMPLE Bitcoin address validation. Returns the validation result after performing the check.
 *
 * The validator supports the following types of Bitcoin addresses:
 * 1. P2PKH (Pay to Public Key Hash) - addresses start with a '1'
 * 2. P2SH (Pay to Script Hash) - addresses start with a '3'
 * 3. Bech32 (native segwit) - addresses start with 'bc1'
 *
 * Please note that these regular expressions only check the length of the address and the starting characters.
 * As a result, some invalid addresses might pass the validation.
 * A thorough validation would involve decoding the base58check (for P2PKH and P2SH addresses)
 * or bech32 (for Bech32 addresses) encoding and checking the checksum,
 * which is generally beyond the capability of regular expressions.
 *
 * @returns A validator function that returns an error map with the 'invalidBtcAddress' property
 * if the validation check fails, and null otherwise.
 */
export function BtcAddressValidator(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    const address = control.value;
    const validP2PKHandP2SH = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
    const validBech32 = /^bc1[A-Za-z0-9]{25,39}$/.test(address);

    return (validP2PKHandP2SH || validBech32) ? null : { 'invalidBtcAddress': { value: control.value } };
  };
}
