import { ApiProperty } from "@nestjs/swagger";


export class TokenOwner {
  @ApiProperty() tokenId: number   ;
  @ApiProperty() owner: string;
  @ApiProperty() ownerName: string;
  @ApiProperty() lender?: string;
  @ApiProperty() lenderName?: string;
}
