import { ApiProperty } from "@nestjs/swagger";


export class TokenOwner {
  @ApiProperty() tokenId: number   ;
  @ApiProperty() owner: string;
  @ApiProperty() ownerDomain: string;
  @ApiProperty() lender?: string;
  @ApiProperty() lenderDomain?: string;
}
