import { Module } from '@nestjs/common';
import { ConsigneCemaaController, ConsigneMageController } from './consigne.controller';
import { ConsigneService } from './consigne.service';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { SharedCryptoModule } from '@sigea/shared-crypto';

/**
 * Un service, deux contrôleurs — un par autorité centrale.
 *
 * Le service cemaa-service n'est PAS renommé : le renommer imposerait de
 * reprendre le docker-compose, la configuration de la passerelle, les URL
 * internes et les scripts de déploiement, pour un gain purement cosmétique.
 * Il sert désormais les deux autorités ; son nom est une dette documentée.
 */
@Module({
  imports: [SharedDatabaseModule, SharedCryptoModule],
  controllers: [ConsigneCemaaController, ConsigneMageController],
  providers: [ConsigneService],
})
export class ConsigneModule {}