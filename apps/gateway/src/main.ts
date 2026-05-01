import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { GatewayModule } from './gateway.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(GatewayModule);
  const logger = new Logger('Bootstrap');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`API Gateway SIGEA running on port ${port}`);
}
bootstrap();