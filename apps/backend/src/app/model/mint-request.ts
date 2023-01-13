import { ApiProperty } from "@nestjs/swagger";

export class MintRequest {

  @ApiProperty({
    description: 'The contract to interact with',
    example: 'genesis',
  })
  tokenName: string;

  @ApiProperty({
    description: 'The msg.sender that will interact with the contract',
    example: '0x0000000000000000000000000000000000000000'
  })
  sender: string;
}
