import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { configurerOpenApi } from '@sigea/shared-openapi';
import { ListeServiceModule } from './liste-service.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ListeServiceModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.setGlobalPrefix('api');

  configurerOpenApi(app, {
    titre: 'SIGEA — Service Listes',
    description:
      "Potentialités, listes hiérarchisées et d'attente, circuit de validation " +
      'SEC_ADJ_AIR → ADJ_AIR → COMRMIA → COMBASE → COMBORD.',
  });

  const port = process.env.PORT ?? 3009;
  await app.listen(port);
  logger.log(`Liste Service SIGEA running on port ${port}`);
}
bootstrap();