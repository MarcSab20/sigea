// apps/notification-service/src/events/events-consumer.module.ts
import { Module } from '@nestjs/common';
import { EventsConsumer } from './events-consumer.service';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [EventsConsumer],
})
export class EventsConsumerModule {}