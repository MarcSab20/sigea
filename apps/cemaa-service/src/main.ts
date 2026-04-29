import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { cemaaserviceModule } from './cemaaservice.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(cemaaserviceModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3006;
  await app.listen(port);
  logger.log(`CEMAA Service SIGEA running on port ${port}`);
}

bootstrap();
