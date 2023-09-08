/**
  * Inscription IDs are of the form TXIDiN, where TXID is the transaction ID of the reveal transaction,
  * and N is the index of the inscription in the reveal transaction.
  */
export function isValidInscriptionId(id: string) {
  return /^[a-fA-F0-9]{64}i\d{1,}$/.test(id);
}
