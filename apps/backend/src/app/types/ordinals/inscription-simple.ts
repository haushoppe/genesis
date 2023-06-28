import { ApiProperty } from '@nestjs/swagger';


export class InscriptionSimple {
  @ApiProperty() inscriptionId: string;
  @ApiProperty() blockheight: number;
}
