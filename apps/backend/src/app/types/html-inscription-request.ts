import { ApiProperty } from '@nestjs/swagger';

export class HtmlInscriptionRequest {

  @ApiProperty({
    description: 'A single Bitcoin address to receive the inscription',
    example: '1BitcoinEaterAddressDontSendf59kuE'
  })
  receiveAddress: string;

  @ApiProperty({
    description: 'Text that should be subscribed',
    example: '<html>Hello World!</html>'
  })
  htmlString: string;

  @ApiProperty({
    description: 'Miner fee that will be paid while inscribing the ordinals in sats/byte.',
    example: 20
  })
  fee: number;
}
