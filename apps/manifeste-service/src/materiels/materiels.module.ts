// apps/manifeste-service/src/materiels/materiels.module.ts
import { Module } from '@nestjs/common';
import { MaterielsController } from './materiels.controller';
import { MaterielsService } from './materiels.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({
  imports: [SharedDatabaseModule],
  controllers: [MaterielsController],
  providers: [MaterielsService],
})
export class MaterielsModule {}