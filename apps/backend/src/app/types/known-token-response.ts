import { ApiProperty } from '@nestjs/swagger';
import { KnownTokenName } from './known-token-name';


export class KnownTokenResponse {
  @ApiProperty() name: KnownTokenName;
  @ApiProperty() address: string;
  @ApiProperty() etherscanLink: string;
  @ApiProperty() signer: string;
  @ApiProperty() maximumAllowedMintsPerAddress: number;
  @ApiProperty() allowlistEntries: number;
  @ApiProperty() contractName: string;
  @ApiProperty() totalSupply: number;
}
