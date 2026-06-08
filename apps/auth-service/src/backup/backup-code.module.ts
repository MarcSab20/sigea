import { Module } from '@nestjs/common';
import { BackupCodeService } from './backup-code.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({ imports: [SharedDatabaseModule], providers: [BackupCodeService], exports: [BackupCodeService] })
export class BackupCodeModule {}