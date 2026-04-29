import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { manifesteserviceModule } from './manifesteservice.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(manifesteserviceModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3004;
  await app.listen(port);
  logger.log(`Manifeste Service SIGEA running on port ${port}`);
}

bootstrap();
