/**
 * The customize form's six side fields accept EITHER a full inscription id
 * (`txid` + `i` + index) OR an inscription NUMBER written as `#12345` or
 * bare `12345`. The field hint promises both spellings, so both must
 * resolve.
 *
 * Normalise a raw field value to the bare digit string ord's
 * `/inscription/<n>` lookup takes, or `null` when the value is not a
 * number (a full id, or anything else) and must be left untouched.
 *
 * A single leading `#` and any surrounding whitespace are stripped.
 * Leading zeros are preserved as typed and handed to ord as-is.
 */
export function inscriptionNumberFromInput(value: string): string | null {
  const digits = value.trim().replace(/^#/, '').trim();
  return /^\d+$/.test(digits) ? digits : null;
}
