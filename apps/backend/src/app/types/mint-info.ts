export interface MintInfo {
  mintedBy: string;
  tokenId: number;
  transactionHash: string;
  blockNumber: number;

  // proprietary extra: ILendable
  isLendable?: boolean;

  // proprietary extra: IMosaic
  isMosaic?: boolean;
  mosaics?: [number, number, number, number] | [];
}
