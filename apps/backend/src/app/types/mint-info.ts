export interface MintInfo {
  newOwner: string;
  tokenId: number;
  transactionHash: string;
  isMosaic?: boolean;
  mosaics?: [number, number, number, number] | []
}
