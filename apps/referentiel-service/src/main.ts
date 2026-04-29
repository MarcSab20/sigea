import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { referentielserviceModule } from './referentielservice.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(referentielserviceModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  logger.log(`Référentiel SIGEA running on port ${port}`);
}

bootstrap();
