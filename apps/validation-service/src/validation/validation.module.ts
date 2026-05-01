import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({
  imports: [SharedDatabaseModule],
})
export class ValidationModule {}