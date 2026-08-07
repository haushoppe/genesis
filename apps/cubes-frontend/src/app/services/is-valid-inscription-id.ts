// TXIDiN in ord's canonical form: 64 hex + `i` + non-negative integer
// WITHOUT leading zeros. `i08262` would pass the naive `\d+` but ord
// never returns that form, so it 404s on lookup.
export function isValidInscriptionId(id: string) {
  return /^[a-f0-9]{64}i(0|[1-9]\d*)$/.test(id);
}
