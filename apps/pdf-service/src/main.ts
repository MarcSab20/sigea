import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { pdfserviceModule } from './pdfservice.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(pdfserviceModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3008;
  await app.listen(port);
  logger.log(`PDF Service SIGEA running on port ${port}`);
}

bootstrap();
