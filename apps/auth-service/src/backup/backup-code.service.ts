import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const CODE_COUNT = 2;

@Injectable()
export class BackupCodeService {
  constructor(private readonly prisma: PrismaService) {}

  private generateCode(): string {
    const raw = crypto.randomBytes(10).toString('hex').toUpperCase();
    return raw.match(/.{1,5}/g)!.join('-');
  }

  async generate(userId: string): Promise<string[]> {
    await this.prisma.backupCode.deleteMany({ where: { user_id: userId } });
    const codes: string[] = [];
    for (let i = 0; i < CODE_COUNT; i++) {
      const code = this.generateCode();
      codes.push(code);
      await this.prisma.backupCode.create({
        data: { user_id: userId, code_hash: await bcrypt.hash(code, 12) },
      });
    }
    return codes;
  }

  async verifyAndConsume(userId: string, code: string): Promise<boolean> {
    const clean = code.trim().toUpperCase().replace(/\s/g, '');
    const candidates = await this.prisma.backupCode.findMany({
      where: { user_id: userId, used: false },
    });
    for (const c of candidates) {
      if (await bcrypt.compare(clean, c.code_hash)) {
        await this.prisma.backupCode.update({
          where: { id: c.id }, data: { used: true, used_at: new Date() },
        });
        return true;
      }
    }
    return false;
  }

  countRemaining(userId: string): Promise<number> {
    return this.prisma.backupCode.count({ where: { user_id: userId, used: false } });
  }
}