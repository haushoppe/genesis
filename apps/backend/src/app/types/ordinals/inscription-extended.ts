import { ApiProperty } from '@nestjs/swagger';
import { Meta } from './meta';


export class InscriptionExtended {
  @ApiProperty() inscriptionId: string;
  @ApiProperty() inscriptionNumber: number;
  @ApiProperty() blockHeight: number;
  @ApiProperty() meta: Meta;
}

export class InscriptionExtendedPaginatedResult {

  @ApiProperty({ description: 'An array of inscriptions', type: InscriptionExtended, isArray: true })
  inscriptions: InscriptionExtended[];

  @ApiProperty({ example: 100, description: 'Total number of all inscriptions' })
  totalInscriptions: number;

  @ApiProperty({ example: 12 })
  itemsPerPage: number;

  @ApiProperty({ example: 1 })
  currentPage: number;
}

export class InscriptionExtendedSingleResult {

  @ApiProperty({ description: 'One inscription' })
  inscription: InscriptionExtended;

  @ApiProperty({ description: 'Previous inscriptionId of a sorted list OR NULL' })
  previousInscriptionId: string | null;

  @ApiProperty({ description: 'Next inscriptionId of a sorted list OR NULL' })
  nextInscriptionId: string | null;
}
