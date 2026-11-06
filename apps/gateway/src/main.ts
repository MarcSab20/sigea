import { NestFactory } from '@nestjs/core';
import { configurerOpenApi } from '@sigea/shared-openapi';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json } from 'express';
import { GatewayModule } from './gateway.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(GatewayModule);
  const logger = new Logger('Bootstrap');

  // ── CORS avec identifiants ──
  //
  // `credentials: true` est INDISPENSABLE depuis que le jeton de
  // rafraîchissement vit dans un cookie : sans lui, le navigateur n'envoie
  // jamais le cookie et ne conserve pas celui que le serveur pose.
  //
  // La liste d'origines est explicite et ne peut pas être `*` : la
  // spécification CORS interdit le joker dès que `credentials` est actif, et
  // le navigateur rejetterait silencieusement chaque réponse.
  //
  // En développement, le frontend passe par le relais de Vite — même origine,
  // donc CORS ne s'applique pas. Cette configuration ne sert qu'en production,
  // ou si l'on attaque la passerelle directement depuis le navigateur.
  const origines = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origines,
    credentials: true,
    // `x-device-fingerprint` est posé par le client sur chaque requête : sans
    // autorisation explicite, le contrôle préalable échoue et plus aucun appel
    // ne passe.
    allowedHeaders: ['Content-Type', 'Authorization', 'x-device-fingerprint'],
    exposedHeaders: ['Content-Disposition'],
  });

  // La passerelle relaie les dépôts de pièces justificatives, transmises en
  // base64. Sans limite explicite, Express plafonne à 100 ko et rejette en 413
  // bien avant que le plafond de 8 Mo de liste-service ne s'applique.
  app.use(json({ limit: '12mb' }));

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.setGlobalPrefix('api');

  // Documentation OpenAPI. Neutralisée en production sauf OPENAPI_ENABLED=1 :
  // voir configurerOpenApi(). À placer APRÈS setGlobalPrefix, sinon les chemins
  // documentés omettraient le préfixe /api.
  configurerOpenApi(app, {
    titre: 'SIGEA — API Gateway',
    description: "API du api gateway du Système Intégré de Gestion des Escales Aériennes.",
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`API Gateway SIGEA running on port ${port} — origines CORS : ${origines.join(', ')}`);
}
bootstrap();