import { ApiProperty } from '@nestjs/swagger';
import { Meta } from './meta'

export class Inscription {
  @ApiProperty({ example: 'INSCRIPTION_ID', description: 'The ID' })
  id: string;

  @ApiProperty({ type: () => Meta, description: 'The meta information' })
  meta: Meta;
}
