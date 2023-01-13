import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { ApiController } from './api/api.controller';
import { CubeController } from './api/cube.controller';
import { ScalesController } from './api/scales.controller';
import { configuration, validationSchema } from './app.configuration';
import { AppController } from './app.controller';
import { AppService } from './model/csv.service';


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
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      // TODO
      useFactory: async (config: ConfigService) => ({
        uri: config.get('mongodbUri'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    })
  ],
  controllers: [AppController, ApiController, CubeController, ScalesController],
  providers: [AppService],
})
export class AppModule { }
