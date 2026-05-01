import { Module } from '@nestjs/common';
import { ConsigneController } from './consigne.controller';
import { ConsigneService } from './consigne.service';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { SharedCryptoModule } from '@sigea/shared-crypto';

@Module({
  imports: [SharedDatabaseModule, SharedCryptoModule],
  controllers: [ConsigneController],
  providers: [ConsigneService],
})
export class ConsigneModule {}