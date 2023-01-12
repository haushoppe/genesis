import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { ApiController } from './api/api.controller';
import { CubeController } from './api/cube.controller';
import { ScalesController } from './api/scales.controller';
import { configuration, validationSchema } from './app.configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'assets'),
      serveRoot: '/assets',
      serveStaticOptions: {
        index: false,
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema
    })
  ],
  controllers: [AppController, ApiController, CubeController, ScalesController],
  providers: [AppService],
})
export class AppModule {}
