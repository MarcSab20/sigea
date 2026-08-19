import { NestFactory } from '@nestjs/core';
import { configurerOpenApi } from '@sigea/shared-openapi';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ReferentielServiceModule } from './referentiel-service.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ReferentielServiceModule);
  const logger = new Logger('Bootstrap');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');
  // Documentation OpenAPI. Neutralisée en production sauf OPENAPI_ENABLED=1 :
  // voir configurerOpenApi(). À placer APRÈS setGlobalPrefix, sinon les chemins
  // documentés omettraient le préfixe /api.
  configurerOpenApi(app, {
    titre: 'SIGEA — Service Référentiel',
    description: "API du service référentiel du Système Intégré de Gestion des Escales Aériennes.",
  });

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  logger.log(`Référentiel SIGEA running on port ${port}`);
}
bootstrap();