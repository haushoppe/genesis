import { ApiProperty } from '@nestjs/swagger';

export class Attribute {
  @ApiProperty({ example: 'background', description: 'The type of trait' })
  trait_type: string;

  @ApiProperty({ example: 'red', description: 'The value of the trait' })
  value: string;
}
