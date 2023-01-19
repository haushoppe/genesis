import { ApiProperty } from "@nestjs/swagger";

export class MetatdataAttribute {
  @ApiProperty() trait_type: string;
  @ApiProperty({
    oneOf: [
      { type: 'string' },
      { type: 'number' }
    ]
  }) value: string | number;
  @ApiProperty() display_type?: 'number' | 'boost_number' | 'boost_percentage' | 'date';
}
