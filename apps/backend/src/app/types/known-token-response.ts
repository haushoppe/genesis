import { ApiProperty } from '@nestjs/swagger';

import { KnownNetworkName } from '../../../../shared/known-network-name';
import { KnownTokenName } from '../../../../shared/known-token-name';


export class Chain {
  @ApiProperty() id: string;
  @ApiProperty() token: string;
  @ApiProperty() label: string;
  @ApiProperty() rpcUrl: string;

  // @ApiProperty({ required: false }) color?: string;
  // @ApiProperty({ required: false }) icon?: string;
  @ApiProperty() publicRpcUrl?: string;
  @ApiProperty() blockExplorerUrl?: string;
}

export class KnownTokenResponse {
  @ApiProperty() name: KnownTokenName;
  @ApiProperty() maximumAllowedMintsPerAddress: number;
  @ApiProperty() address: string;
  @ApiProperty() networkName: KnownNetworkName.hardhat | KnownNetworkName.goerli | KnownNetworkName.mainnet;
  @ApiProperty() networkConfig: Chain;
  @ApiProperty() firstBlockNumber: number;
  @ApiProperty() implementsMosaics: boolean | undefined;

  @ApiProperty() explorerLink: string;
  @ApiProperty() signer: string;
  @ApiProperty() allowlistEntries: number;
  @ApiProperty() contractName: string;
  @ApiProperty() totalSupply: number;
}
