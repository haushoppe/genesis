import { AbstractControl, ValidatorFn } from '@angular/forms';

export function InscriptionIdValidator(): ValidatorFn {
  return (control: AbstractControl<string>): { [key: string]: { value: string } } | null => {

    // Inscription IDs are of the form TXIDiN, where TXID is the transaction ID of the reveal transaction,
    // and N is the index of the inscription in the reveal transaction.
    const valid = /^[a-fA-F0-9]{64}i\d{1,}$/.test(control.value);
    return valid ? null : { 'invalidInscriptionId': { value: control.value } };
  };
}

