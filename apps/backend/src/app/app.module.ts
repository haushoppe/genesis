import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { allKnownTokenNames, KnownTokenName } from '../../../shared/known-token-name';
import { ApiController } from './api/api.controller';
import { CubeController } from './api/cube.controller';
import { OrdinalsController } from './api/ordinals.controller';
import { ScalesController } from './api/scales.controller';
import { configuration, validationSchema } from './app.configuration';
import { AppController } from './app.controller';
import { AllowlistService } from './model/allowlist.service';
import { CacheService } from './model/cache.service';
import { ContractService } from './model/contract.service';
import { ImageService } from './model/image.service';
import { MetadataGenesisService } from './model/metadata-genesis.service';
import { MetadataService } from './model/metadata-service';
import { CubeSuggestionService } from './model/ordinals/cube-suggestion.service';
import { MagicEdenService } from './model/ordinals/magic-eden.service';


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
  controllers: [
    AppController,
    ApiController,
    ScalesController,
    CubeController,
    OrdinalsController
  ],
  providers: [
    AllowlistService,
    MetadataGenesisService,
    ImageService,
    MagicEdenService,
    CubeSuggestionService,
    CacheService,
    ...allKnownTokenNames.map((tokenName: KnownTokenName) => ({
      provide: tokenName,
      useFactory: (
        configService: ConfigService,
        cacheService: CacheService
      ) => {

        let metadataService: MetadataService = { generateMetadata: () => [] };
        if (tokenName === KnownTokenName.genesis) {
          metadataService = new MetadataGenesisService(configService);
        }

        return new ContractService(configService, tokenName, metadataService, cacheService);
      },
      inject: [ConfigService, CacheService]
    }))
  ],
})
export class AppModule { }


