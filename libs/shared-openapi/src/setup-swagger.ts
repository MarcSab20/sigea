// libs/shared-openapi/src/setup-swagger.ts
//
// Exposition OpenAPI mutualisée. Les DTO portant déjà des décorateurs
// class-validator, le plugin CLI de @nestjs/swagger déduit l'essentiel du
// schéma sans annotation supplémentaire (voir la note d'activation en bas).

import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';

export interface OptionsOpenApi {
  /** Titre affiché, ex. « SIGEA — Service Validation ». */
  titre: string;
  description: string;
  version?: string;
  /** Chemin d'exposition, relatif au préfixe global. Défaut : 'docs'. */
  chemin?: string;
  /** Étiquettes déclarées en tête de document. */
  tags?: string[];
}

/**
 * Monte Swagger UI et le document JSON.
 *
 * NEUTRALISÉ EN PRODUCTION par défaut : publier la cartographie complète des
 * endpoints d'un système classifié est un cadeau fait à un attaquant. Pour
 * l'exposer malgré tout sur un réseau maîtrisé, poser OPENAPI_ENABLED=1.
 */
export function configurerOpenApi(app: INestApplication, opts: OptionsOpenApi): void {
  const enProduction = process.env.NODE_ENV === 'production';
  if (enProduction && process.env.OPENAPI_ENABLED !== '1') return;

  const builder = new DocumentBuilder()
    .setTitle(opts.titre)
    .setDescription(
      `${opts.description}\n\n` +
        "**Diffusion restreinte.** Cette documentation décrit une API du système SIGEA " +
        "(Forces Aériennes Camerounaises). Elle n'a pas vocation à être exposée hors du " +
        'réseau de la Défense.',
    )
    .setVersion(opts.version ?? '1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Jeton RS256 délivré par auth-service' },
      'jwt',
    )
    .addServer('/api', 'Via la gateway');

  for (const tag of opts.tags ?? []) builder.addTag(tag);

  const document: OpenAPIObject = SwaggerModule.createDocument(app, builder.build());

  SwaggerModule.setup(opts.chemin ?? 'docs', app, document, {
    jsonDocumentUrl: `${opts.chemin ?? 'docs'}/json`,
    swaggerOptions: {
      // Le jeton saisi survit au rechargement de page : sans cela, tester une
      // route authentifiée impose de le recoller à chaque essai.
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: opts.titre,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Activation de l'inférence automatique des schémas
// ─────────────────────────────────────────────────────────────────────────────
// Sans le plugin CLI, les DTO apparaissent vides dans Swagger : TypeScript
// efface les types à la compilation et le décorateur @IsString() seul ne suffit
// pas à reconstituer le schéma.
//
// Pour chaque service, ajouter dans son `project.json`, cible `build` :
//
//   "transformers": [
//     { "name": "@nestjs/swagger/plugin", "options": { "dtoFileNameSuffix": [".dto.ts"] } }
//   ]
//
// Les builds Docker passant par tsc directement, la même déclaration doit être
// reportée dans docker/tsconfig.docker-base.json sous "plugins".
