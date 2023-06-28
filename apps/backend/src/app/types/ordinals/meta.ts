import { ApiProperty } from '@nestjs/swagger';
import { Attribute } from './attribute';

export class Meta {
  @ApiProperty({ example: 'Acme Inc #1', description: 'The name' })
  name: string;

  @ApiProperty({ type: () => [Attribute], description: 'The list of attributes' })
  attributes: Attribute[];
}
