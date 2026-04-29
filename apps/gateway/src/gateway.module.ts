import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CloisonnementMiddleware } from './middleware/cloisonnement.middleware';
import { ProxyModule } from './proxy/proxy.module';
import { HealthModule } from './health/health.module';
import gatewayConfig from './config/gateway.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [gatewayConfig] }),
    HttpModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ProxyModule,
    HealthModule,
  ],
})
export class GatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CloisonnementMiddleware).forRoutes('*');
  }
}
