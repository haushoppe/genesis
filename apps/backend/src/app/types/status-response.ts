import { ApiProperty } from '@nestjs/swagger';
import { KnownTokenResponse } from './known-token-response';


export class StatusResponse {
  @ApiProperty() environment: 'development' | 'production';
  @ApiProperty() uptime: string;
  @ApiProperty({ type: KnownTokenResponse, isArray: true }) knownTokens: KnownTokenResponse[];
}
