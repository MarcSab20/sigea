import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ManifesteServiceModule } from './manifeste-service.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ManifesteServiceModule);
  const logger = new Logger('Bootstrap');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3004;
  await app.listen(port);
  logger.log(`Manifeste Service SIGEA running on port ${port}`);
}
bootstrap();