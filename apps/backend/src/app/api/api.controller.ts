import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';


@ApiTags('api')
@Controller()
export class ApiController {

  constructor(private config: ConfigService) { }

  /**
   * Status of this service
   */
  @Get(['api/status'])
  async getStatus() {
    return {
      environment: this.config.get('environment'),
      uptime: this.formatSeconds(process.uptime())
    };
  }

  private formatSeconds(seconds: number) {
    const pad = function (s: number) {
      return (s < 10 ? '0' : '') + s;
    }
    const hours = Math.floor(seconds / (60 * 60));
    const minutes = Math.floor(seconds % (60 * 60) / 60);
    const secs = Math.floor(seconds % 60);

    return pad(hours) + ':' + pad(minutes) + ':' + pad(secs);
  }
}
