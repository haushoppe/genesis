import { ApiProperty } from '@nestjs/swagger';
import { ConfigDetails } from "./config-details";


export class ConfigResponse {
  @ApiProperty() environment: 'development' | 'production';
  @ApiProperty() uptime: string;
  @ApiProperty({ type: ConfigDetails }) config: ConfigDetails;
}
