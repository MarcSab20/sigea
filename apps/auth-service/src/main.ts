import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { authserviceModule } from './authservice.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(authserviceModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`Auth Service SIGEA running on port ${port}`);
}

bootstrap();
