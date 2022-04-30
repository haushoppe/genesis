import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
const Moralis = require('moralis/node');

import { AppModule } from './app/app.module';

const port = process.env.PORT || 2222; // see .env file

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const openApiConfig = new DocumentBuilder()
    .setTitle('❒ Cube API')
    .setDescription('The Collectors Cube API (early alpha preview)')
    .setVersion('1.0')
    // .addTag('cats')
    .build();

  await Moralis.start({
    serverUrl: config.get('manifoldServerUrl'),
    appId: config.get('manifoldAppId'),
    masterKey: config.get('manifoldMasterKey')
  });

  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('open-api', app, document);

  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${ port }/`);
  Logger.log(`🚀 Running in ${ config.get('environment') } mode`);
}

bootstrap();
