import { AbstractControl, ValidatorFn } from '@angular/forms';

/**
 * A validator function that checks whether a string value is valid.
 *
 * 1. A string can be null, empty, or whitespace - VALID
 * 2. If the string contains characters that are not whitespaces it must end with an underscore and a number, eg. "_0" or "_3500" - VALID
 * 3. If it's any other string, then its INVALID
 *
 * @returns {ValidatorFn} A validator function that returns an error map or null.
 */
export function CorrectCodeValidator(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: { value: string } } | null => {
    const str = control.value;

    // Case 1: Null, empty, or whitespace
    if (!str || /^\s*$/.test(str)) {
      return null;
    }

    // Case 2: Ends with underscore and a number
    if (/_\d+$/.test(str)) {
      return null;
    }

    // Case 3: All other strings
    return { 'incorrectCode': { value: str } };
  };
}
