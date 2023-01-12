import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app/app.module';

const port = process.env.PORT || 2222; // see .env file

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const openApiConfig = new DocumentBuilder()
    .setTitle('🎨 NFT API')
    .setDescription('Serves data for our NFT projects')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('open-api', app, document);

  // https://docs.nestjs.com/security/cors
  app.enableCors();
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${ port }/`);
  Logger.log(`🚀 Running in ${ config.get('environment') } mode`);
}

bootstrap();
