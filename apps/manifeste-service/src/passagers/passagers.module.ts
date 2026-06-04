// apps/manifeste-service/src/passagers/passagers.module.ts
import { Module } from '@nestjs/common';
import { PassagersController } from './passagers.controller';
import { PassagersService } from './passagers.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({
  imports: [SharedDatabaseModule],
  controllers: [PassagersController],
  providers: [PassagersService],
})
export class PassagersModule {}