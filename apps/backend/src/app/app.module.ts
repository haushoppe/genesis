import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { ApiController } from './api/api.controller';
import { CubeController } from './api/cube.controller';
import { ScalesController } from './api/scales.controller';
import { configuration, validationSchema } from './app.configuration';
import { AppController } from './app.controller';
import { AllowlistService } from './model/allowlist.service';
import { CacheService } from './model/cache.service';
import { ImageService } from './model/image.service';
import { MetadataGenesisService } from './model/metadata-genesis.service';
import { KnownTokenName, allKnownTokenNames } from '../../../shared/known-token-name';
import { ContractService } from './model/contract.service';


@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'assets/public'),
      serveRoot: '/public',
      serveStaticOptions: {
        index: false,
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema
    }),
    // MongooseModule.forRootAsync({
    //   imports: [ConfigModule],
    //   // TODO
    //   useFactory: async (configService: ConfigService) => ({
    //     uri: configService.get('mongodbUri'),
    //     useNewUrlParser: true,
    //     useUnifiedTopology: true,
    //   }),
    //   inject: [ConfigService],
    // })
  ],
  controllers: [AppController, ApiController, ScalesController, CubeController],
  providers: [
    AllowlistService,
    MetadataGenesisService,
    ImageService,
    CacheService,
    ...allKnownTokenNames.map((tokenName: KnownTokenName) => ({
      provide: tokenName,
      useFactory: (
        configService: ConfigService,
        cacheService: CacheService
      ) => {
        return new ContractService(configService, tokenName, cacheService);
      },
      inject: [ConfigService, CacheService]
    }))
  ],
})
export class AppModule { }


