// libs/shared-integrity/src/integrity.module.ts
import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { SnapshotService } from './snapshot.service';

@Module({
  imports: [SharedDatabaseModule],
  providers: [SnapshotService],
  exports: [SnapshotService],
})
export class IntegrityModule {}
