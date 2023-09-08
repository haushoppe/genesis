import { AbstractControl, ValidatorFn } from '@angular/forms';
import { isValidInscriptionId } from '../../services/is-valid-inscription-id';

export function InscriptionIdValidator(): ValidatorFn {
  return (control: AbstractControl<string>): { [key: string]: { value: string } } | null => {
    const valid = isValidInscriptionId(control.value);
    return valid ? null : { 'invalidInscriptionId': { value: control.value } };
  };
}

