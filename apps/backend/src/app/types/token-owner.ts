import { ApiProperty } from "@nestjs/swagger";


export class TokenOwner {
  @ApiProperty() tokenId: number   ;
  @ApiProperty() owner: string;
  @ApiProperty() lender?: string;
}
