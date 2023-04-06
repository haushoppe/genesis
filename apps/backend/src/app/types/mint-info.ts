export interface MintInfo {
  mintedBy: string;
  tokenId: number;
  transactionHash: string;
  blockNumber: number;
  isMosaic?: boolean;
  mosaics?: [number, number, number, number] | [];
}
