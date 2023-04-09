import { ApiProperty } from "@nestjs/swagger";


export class TokenOwner {
  @ApiProperty() owner: string;
  @ApiProperty() lender?: string;
}
