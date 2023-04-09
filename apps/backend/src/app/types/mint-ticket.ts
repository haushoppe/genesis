import { ApiProperty } from "@nestjs/swagger";

export class MintTicket {

  @ApiProperty({
    description: 'The hashed message, which contains msg.sender + maximumAllowedMints'
  })
  messageHash: string;

  @ApiProperty({
    description: 'The secret signature that only this API can create'
  })
  signature: string;

  @ApiProperty({
    description: 'Maximum allowed mints'
  })
  maximumAllowedMints: number
}
