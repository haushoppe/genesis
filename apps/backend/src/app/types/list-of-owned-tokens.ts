import { ApiProperty } from "@nestjs/swagger";
import { Metadata } from "./metadata";


export class ListOfOwnedTokens {
  @ApiProperty({ type: Metadata, isArray: true })
  owned: Metadata[];

  @ApiProperty({ type: Metadata, isArray: true })
  lended: Metadata[];
}
