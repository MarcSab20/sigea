import { Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({ imports: [SharedDatabaseModule], providers: [SecurityService], exports: [SecurityService] })
export class SecurityModule {}