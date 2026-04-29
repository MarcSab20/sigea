import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({ imports: [SharedDatabaseModule], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
