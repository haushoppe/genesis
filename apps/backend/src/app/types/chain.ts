import { ApiProperty } from '@nestjs/swagger';

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


