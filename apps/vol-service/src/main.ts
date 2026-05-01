import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { VolServiceModule } from './vol-service.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(VolServiceModule);
  const logger = new Logger('Bootstrap');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  logger.log(`Vol Service SIGEA running on port ${port}`);
}
bootstrap();