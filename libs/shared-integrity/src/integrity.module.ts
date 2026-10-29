// libs/shared-integrity/src/integrity.module.ts
import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { SnapshotService } from './snapshot.service';
import { ListeSnapshotService } from './liste-snapshot.service';

@Module({
  imports: [SharedDatabaseModule],
  providers: [SnapshotService, ListeSnapshotService],
  exports: [SnapshotService, ListeSnapshotService],
})
export class IntegrityModule {}