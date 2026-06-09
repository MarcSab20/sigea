// libs/shared-messaging/src/messaging.module.ts
import { Module, Global } from '@nestjs/common';
import { EventPublisher } from './event-publisher.service';

/**
 * Module global : il suffit de l'importer UNE FOIS dans le module racine
 * d'un service producteur pour pouvoir injecter EventPublisher partout.
 */
@Global()
@Module({
  providers: [EventPublisher],
  exports: [EventPublisher],
})
export class MessagingModule {}
