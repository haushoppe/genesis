import { ApiProperty } from '@nestjs/swagger';
import { KnownNetworkName } from '../../../../shared/known-network-name';
import { KnownTokenName } from '../../../../shared/known-token-name';
import { Chain } from './chain';


export class ConfigDetails {
  @ApiProperty() name: KnownTokenName;
  @ApiProperty() maximumAllowedMintsPerAddress: number;
  @ApiProperty() contractAddress: string;
  @ApiProperty() networkName: KnownNetworkName.hardhat | KnownNetworkName.goerli | KnownNetworkName.mainnet;
  @ApiProperty() networkConfig: Chain;
  @ApiProperty() firstBlockNumber: number;
  @ApiProperty() implementsMosaics: boolean | undefined;

  @ApiProperty() explorerLink: string;
  @ApiProperty() signer: string;
  @ApiProperty() allowlistEntries: number;
  @ApiProperty() contractName: string;
  @ApiProperty() totalSupply: number;
  @ApiProperty() price: string;
  @ApiProperty() priceForMosaic: string;
}
