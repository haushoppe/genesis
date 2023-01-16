import { ApiProperty } from '@nestjs/swagger';

import { ZERO_ADDRESS } from './ethers-utils';
import { KnownTokenName } from './known-token-name';

export class MintRequest {

  @ApiProperty({
    description: 'The contract to interact with',
    example: KnownTokenName.genesis,
    enum: KnownTokenName,
  })
  tokenName: KnownTokenName;

  @ApiProperty({
    description: 'The msg.sender that will interact with the contract',
    example: ZERO_ADDRESS
  })
  sender: string;
}
