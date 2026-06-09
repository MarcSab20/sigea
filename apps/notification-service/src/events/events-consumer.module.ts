// apps/notification-service/src/events/events-consumer.module.ts
import { Module } from '@nestjs/common';
import { EventsConsumer } from './events-consumer.service';
import { NotificationGatewayModule } from '../gateway/notification-gateway.module';

@Module({
  imports: [NotificationGatewayModule],
  providers: [EventsConsumer],
})
export class EventsConsumerModule {}
