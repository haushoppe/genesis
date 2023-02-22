import { ApiProperty } from '@nestjs/swagger';
import { KnownTokenName } from '../../../../shared/known-token-name';


export class KnownTokenResponse {
  @ApiProperty() name: KnownTokenName;
  @ApiProperty() maximumAllowedMintsPerAddress: number;
  @ApiProperty() address: string;
  @ApiProperty() network: 'hardhat' | 'goerli' | 'mainnet';
  @ApiProperty() firstBlockNumber: number;
  @ApiProperty() implementsMosaics: boolean | undefined;

  @ApiProperty() etherscanLink: string;
  @ApiProperty() signer: string;
  @ApiProperty() allowlistEntries: number;
  @ApiProperty() contractName: string;
  @ApiProperty() totalSupply: number;
}
