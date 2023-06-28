import { ApiProperty } from '@nestjs/swagger';


export class Price {
  @ApiProperty() priceInSats: number;
  @ApiProperty() priceInUsd: number;

}
