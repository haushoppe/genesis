import { ApiProperty } from '@nestjs/swagger';
import { Meta } from './meta';


export class InscriptionSimple {
  @ApiProperty() inscriptionId: string;
  @ApiProperty() meta: Meta;
}
