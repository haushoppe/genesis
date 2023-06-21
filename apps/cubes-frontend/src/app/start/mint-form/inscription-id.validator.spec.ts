import { FormControl } from '@angular/forms';
import { InscriptionIdValidator } from './inscription-id.validator';

describe('InscriptionIdValidator', () => {
  it('should validate correctly', () => {

    // Inscription IDs are of the form TXIDiN, where TXID is the transaction ID of the reveal transaction, and N is the index of the inscription in the reveal transaction.
    // creation transaction - 2dbdf9ebbec6be793fd16ae9b797c7cf968ab2427166aaf390b90b71778266ab
    // inscription id       - 2dbdf9ebbec6be793fd16ae9b797c7cf968ab2427166aaf390b90b71778266abi0
    let control = new FormControl('2dbdf9ebbec6be793fd16ae9b797c7cf968ab2427166aaf390b90b71778266abi0');
    expect(InscriptionIdValidator()(control)).toBeNull();

    control = new FormControl('invalid-id');
    expect(InscriptionIdValidator()(control)).toEqual({ 'invalidInscriptionId': { value: 'invalid-id' } });
  });
});
