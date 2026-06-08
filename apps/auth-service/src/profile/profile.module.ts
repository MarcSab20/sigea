import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { BackupCodeModule } from '../backup/backup-code.module';

@Module({
  imports: [SharedDatabaseModule, BackupCodeModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}