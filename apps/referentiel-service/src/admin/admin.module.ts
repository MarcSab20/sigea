import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({
  imports: [SharedDatabaseModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}