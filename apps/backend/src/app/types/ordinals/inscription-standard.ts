import { ApiProperty } from '@nestjs/swagger';
import { Meta } from './meta'

/**
 * "Ordinals Collections Standard"
 * The format for inscriptions that is used here:
 * https://github.com/ordinals-wallet/ordinals-collections
 */
export class InscriptionStandad {
  @ApiProperty({ example: 'INSCRIPTION_ID', description: 'The ID' })
  id: string;

  @ApiProperty({ type: () => Meta, description: 'The meta information' })
  meta: Meta;
}
