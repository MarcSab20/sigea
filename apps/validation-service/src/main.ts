import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { validationserviceModule } from './validationservice.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(validationserviceModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3005;
  await app.listen(port);
  logger.log(`Validation Service SIGEA running on port ${port}`);
}

bootstrap();
