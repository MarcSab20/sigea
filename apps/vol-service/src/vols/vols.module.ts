// apps/vol-service/src/vols/vols.module.ts
//
// MessagingModule n'est pas importé ici : il est déclaré @Global et importé
// une seule fois dans VolServiceModule. L'importer de nouveau n'apporterait
// rien et laisserait croire à une dépendance locale.
import { Module } from '@nestjs/common';
import { VolsController } from './vols.controller';
import { VolsService } from './vols.service';

@Module({
  controllers: [VolsController],
  providers: [VolsService],
  exports: [VolsService],
})
export class VolsModule {}