import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { AuditEntry } from '@sigea/shared-types';
import * as crypto from 'crypto';

/**
 * Entrée du journal.
 *
 * `AuditEntry` (shared-types) ne porte ni `method` ni `path`, alors que le
 * modèle Prisma `AuditLog` les prévoit — et ce sont les deux colonnes les plus
 * utiles pour relire une ligne : sans elles, on sait qu'une action a eu lieu
 * mais pas sur quelle route. On étend donc localement plutôt que de toucher au
 * contrat partagé, qui sert aussi ailleurs.
 */
export type EntreeAudit = AuditEntry & {
  method?: string;
  path?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Écrit une ligne de journal, scellée par son empreinte.
   *
   * L'empreinte est calculée sur le contenu métier AVANT insertion : elle
   * atteste de ce qui a été enregistré, indépendamment de l'identifiant et de
   * l'horodatage attribués par la base.
   */
  async log(entry: EntreeAudit): Promise<void> {
    const hash = crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');

    await this.prisma.auditLog.create({
      data: {
        user_id: entry.user_id,
        base_id: entry.base_id,
        role: entry.role,
        action: entry.action,
        resource: entry.resource ?? null,
        method: entry.method ?? null,
        path: entry.path ?? null,
        ip: entry.ip ?? null,
        content_hash: hash,
        timestamp: new Date(entry.timestamp),
      },
    });
  }
}