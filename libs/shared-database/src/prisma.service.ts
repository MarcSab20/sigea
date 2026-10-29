// libs/shared-database/src/prisma.service.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// DÉFAUT CORRIGÉ : LE CONTEXTE RLS N'EN ÉTAIT PAS UN
// ═══════════════════════════════════════════════════════════════════════════
// La méthode `setRlsContext()` existait, mais elle ne pouvait pas fonctionner,
// pour deux raisons cumulées :
//
//   1. `set_config(..., true)` pose une variable LOCALE À LA TRANSACTION.
//      Appelée hors transaction, elle est perdue avant la requête suivante.
//
//   2. Prisma utilise un POOL de connexions. Rien ne garantit que la requête
//      métier parte sur la connexion qui a reçu le set_config. Avec `false`
//      (variable de session), le défaut serait pire encore : le contexte d'un
//      utilisateur resterait collé à la connexion et serait hérité par la
//      requête suivante, possiblement celle d'un autre utilisateur.
//
// Et surtout : aucun appelant ne l'invoquait. Le grep est sans appel, elle
// n'était référencée nulle part. Activer `prisma/rls.sql` dans cet état aurait
// bloqué TOUTES les lectures — `current_setting` renvoyant la chaîne vide,
// aucune ligne n'aurait satisfait la politique.
//
// `avecContexte()` corrige les deux points : la variable est posée ET la
// requête exécutée dans la MÊME transaction, donc sur la même connexion.
//
// ── À lire avant d'activer RLS ──
// Le cloisonnement effectif de SIGEA est aujourd'hui APPLICATIF : PerimetreGuard
// pour les routes, clauses `where` dans chaque service. Il est complet et
// testé. RLS en est un second rempart, pas un remplacement — il protège contre
// une requête applicative mal écrite, pas contre une habilitation mal pensée.
// Ne l'activez qu'après avoir fait passer les écritures sensibles par
// `avecContexte()`, et vérifiez en recette qu'aucun écran ne se vide.

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

/** Contexte d'habilitation propagé à PostgreSQL. */
export interface ContexteRls {
  user_id: string;
  base_id: string;
  role:    string;
  /** Nulle pour les rôles qui ne relèvent pas d'une région. */
  rmia?:   string | null;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('PostgreSQL connecté');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Exécute `travail` dans une transaction portant le contexte d'habilitation.
   *
   * Le `set_config(..., true)` est local à la transaction : il disparaît au
   * COMMIT, et ne peut donc pas fuir vers la requête d'un autre utilisateur via
   * une connexion réutilisée du pool. C'est précisément ce que l'ancienne
   * implémentation ne garantissait pas.
   *
   * `$executeRaw` et non `$executeRawUnsafe` : les valeurs sont paramétrées,
   * jamais concaténées. Un `role` ou un `base_id` venant d'un jeton reste une
   * donnée d'entrée, et une donnée d'entrée ne se colle pas dans du SQL.
   */
  async avecContexte<T>(
    ctx: ContexteRls,
    travail: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT
          set_config('app.current_user_id', ${ctx.user_id}, true),
          set_config('app.current_base_id', ${ctx.base_id}, true),
          set_config('app.current_role',    ${ctx.role},    true),
          set_config('app.current_rmia',    ${ctx.rmia ?? ''}, true)
      `;
      return travail(tx);
    });
  }

  /**
   * @deprecated Ne garantit rien et ne doit plus être utilisée.
   *
   * Conservée uniquement pour que d'éventuels appelants continuent de compiler
   * le temps de leur reprise. Elle journalise un avertissement : un appel
   * silencieux laisserait croire à une protection inexistante, ce qui est pire
   * que pas de protection du tout.
   *
   * Utilisez `avecContexte()`.
   */
  async setRlsContext(base_id: string, role: string): Promise<void> {
    this.logger.warn(
      'setRlsContext() est sans effet hors transaction (pool de connexions). ' +
        'Utilisez avecContexte(). Appel ignoré pour ' +
        `base=${base_id} role=${role}.`,
    );
  }
}