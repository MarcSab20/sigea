// apps/notification-service/src/messagerie/messagerie.module.ts

import { Module, Logger } from '@nestjs/common';
import { MessagerieService } from './messagerie.service';
import { MessagerieConsumer } from './messagerie.consumer';
import { MessagerieController } from './messagerie.controller';
import { OPERATEUR_SMS, OperateurSms } from './operateur.port';
import { HttpOperateurAdapter } from './adapters/http-operateur.adapter';
import { JournalOperateurAdapter } from './adapters/journal-operateur.adapter';

/**
 * Choix de l'opérateur au démarrage, sur la seule présence de
 * SMS_OPERATEUR_URL.
 *
 * Pas de variable « SMS_MODE » à trois valeurs : un interrupteur distinct de la
 * configuration finit toujours par être positionné à l'envers, et l'on
 * découvre alors en production que rien n'est parti depuis trois semaines.
 * Ici, l'absence d'URL est à la fois la cause et la condition.
 *
 * Le jour où un opérateur non-HTTP est retenu, c'est cette fabrique — et elle
 * seule — qui change.
 */
@Module({
  controllers: [MessagerieController],
  providers: [
    HttpOperateurAdapter,
    JournalOperateurAdapter,
    {
      provide: OPERATEUR_SMS,
      inject: [HttpOperateurAdapter, JournalOperateurAdapter],
      useFactory: (
        http: HttpOperateurAdapter,
        journal: JournalOperateurAdapter,
      ): OperateurSms => {
        const logger = new Logger('MessagerieModule');
        if (http.estConfigure()) {
          logger.log(`Opérateur SMS : ${http.nom}`);
          return http;
        }
        logger.warn(
          'SMS_OPERATEUR_URL absente — aucun message ne sera réellement envoyé. ' +
            'Les messages sont journalisés et restent en file.',
        );
        return journal;
      },
    },
    MessagerieService,
    MessagerieConsumer,
  ],
  exports: [MessagerieService],
})
export class MessagerieModule {}