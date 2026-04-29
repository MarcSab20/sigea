import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { AuditEntry } from '@sigea/shared-types';
import * as crypto from 'crypto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    const content = JSON.stringify(entry);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    await this.prisma.auditLog.create({
      data: { ...entry, content_hash: hash },
    });
  }
}
