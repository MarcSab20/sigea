import { NestFactory } from '@nestjs/core';
import { configurerOpenApi } from '@sigea/shared-openapi';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ManifesteServiceModule } from './manifeste-service.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ManifesteServiceModule);
  const logger = new Logger('Bootstrap');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');
  // Documentation OpenAPI. Neutralisée en production sauf OPENAPI_ENABLED=1 :
  // voir configurerOpenApi(). À placer APRÈS setGlobalPrefix, sinon les chemins
  // documentés omettraient le préfixe /api.
  configurerOpenApi(app, {
    titre: 'SIGEA — Service Manifestes',
    description: "API du service manifestes du Système Intégré de Gestion des Escales Aériennes.",
  });

  const port = process.env.PORT ?? 3004;
  await app.listen(port);
  logger.log(`Manifeste Service SIGEA running on port ${port}`);
}
bootstrap();