import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { notificationserviceModule } from './notificationservice.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(notificationserviceModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3007;
  await app.listen(port);
  logger.log(`Notification Service SIGEA running on port ${port}`);
}

bootstrap();
