import { ApiProperty } from '@nestjs/swagger';

export class CubeSuggestion {

  @ApiProperty({
    description: 'InscriptionId for Side 1',
    example: '09da2c75de72d006e2f24dac29a27976963a5723abe110cf2c29d1cf9225fb36i0'
  })
  inscriptionId1: string;

  @ApiProperty({
    description: 'InscriptionId for Side 2',
    example: 'ce1e4fd0f31f802d2348ab27eeec9385f4e58e5f81606cd94200fcd05c622a37i0'
  })
  inscriptionId2: string;

  @ApiProperty({
    description: 'InscriptionId for Side 3',
    example: 'dfcf3fc4aec42d2c0bdb3b6d26a4dac4ea7893b70f6b42ae9e5ac883621c6537i0'
  })
  inscriptionId3: string;

  @ApiProperty({
    description: 'InscriptionId for Side 4',
    example: '519bca4c2adec9c41f3de0099202d495ddf66c664fa801c14fc723a836938550i0'
  })
  inscriptionId4: string;

  @ApiProperty({
    description: 'InscriptionId for Side 5',
    example: 'f1ac3821de11c8fe7eabe39027915806662bc6e87a236e90f088cc3b371eaa80i0'
  })
  inscriptionId5: string;

  @ApiProperty({
    description: 'InscriptionId for Side 6',
    example: 'f44905aeb2bdb5ac3e71999d6648b6425018656898c8c55fd7a3b7df7ab79ac2i0'
  })
  inscriptionId6: string;

  @ApiProperty({
    description: 'Title for the Cube',
    example: 'Demo Cube'
  })
  title: string;
}
