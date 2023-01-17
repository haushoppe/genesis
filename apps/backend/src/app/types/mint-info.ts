export interface MintInfo {
  newOwner: string;
  tokenId: number;
  transactionHash: string;
  blockNumber: number;
  isMosaic?: boolean;
  mosaics?: [number, number, number, number] | [];
}
