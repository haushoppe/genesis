import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app/app.module';
import { AllExceptionsFilter } from './all-exceptions.filter';

const port = process.env.PORT || 2222; // see .env file

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const openApiConfig = new DocumentBuilder()
    .setTitle('🎨 API')
    .setDescription('Serves data for our projects')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('open-api', app, document);

  // https://docs.nestjs.com/security/cors
  app.enableCors();
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${ port }/`);
  Logger.log(`🚀 Running in ${ config.get('environment') } mode`);
}

bootstrap();
