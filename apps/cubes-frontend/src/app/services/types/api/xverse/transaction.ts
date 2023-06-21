import BigNumber from 'bignumber.js';
import {
  TokenType,
  TransactionType,
  TransactionStatus,
  ContractCall,
  TransactionPostCondition,
} from '../shared/transaction';

export type TransactionData = {
  txid: string;
  amount: BigNumber;
  seenTime: Date;
  incoming: boolean;
  txType: TransactionType;
  txStatus: TransactionStatus;
  contractCall?: ContractCall;
  post_conditions?: Array<TransactionPostCondition>;
  tokenType?: TokenType;
  tokenName?: string;
  recipientAddress?: string;
  memo?: string;
  cycles?: string;
  rewardAddress?: string;
  poolPoxAddress?: string;
  untilBurnHt?: string;
  poolContractAddress?: string;
  poolContractName?: string;
  assetId?: string;
};

export type BtcFeeResponse = {
  limits: {
    min: number;
    max: number;
  };
  regular: number;
  priority: number;
};
export interface FeesMultipliers {
  stxSendTxMultiplier: number;
  poolStackingTxMultiplier: number;
  otherTxMultiplier: number;
}
