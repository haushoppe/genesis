import * as esplora from '../../../types/api/esplora';

export interface InscriptionRequestResponse {
  charge: {
    id: string;
    created_at: number;
    address: string;
    amount: number;
    fiat_value: number;
  };
  baseFee: number;
  chainFee: number;
  serviceFee: number;
  receiveAddress: string;
}

export interface InscriptionRequestResponseAndFeesResponse {
  inscriptionRequest: InscriptionRequestResponse;
  feesResponse: esplora.RecommendedFeeResponse;
}
