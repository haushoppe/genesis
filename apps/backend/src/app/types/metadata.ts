import { ApiProperty } from "@nestjs/swagger";
import { MetatdataAttribute } from "./metatdata-attribute";


export class Metadata {
  @ApiProperty() description: string;
  @ApiProperty() external_url: string;
  @ApiProperty() image: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: MetatdataAttribute, isArray: true }) attributes: MetatdataAttribute[];

  // not standard
  @ApiProperty() tokenId?: number;
}
