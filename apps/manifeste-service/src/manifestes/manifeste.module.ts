import { Module } from '@nestjs/common';
import { ManifesteController } from './manifeste.controller';
import { ManifesteService } from './manifeste.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({
  imports: [SharedDatabaseModule],
  controllers: [ManifesteController],
  providers: [ManifesteService],
})
export class ManifesteModule {}