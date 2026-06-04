// apps/gateway/src/gateway.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ThrottlerModule } from '@nestjs/throttler';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TerminusModule } from '@nestjs/terminus';
import { ProxyModule } from './proxy/proxy.module';
import { HealthModule } from './health/health.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import gatewayConfig from './config/gateway.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [gatewayConfig] }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        publicKey: config.get<string>('JWT_PUBLIC_KEY')
          ? Buffer.from(config.get<string>('JWT_PUBLIC_KEY')!, 'base64').toString('utf8')
          : '',
        verifyOptions: { algorithms: ['RS256'] as const },
      }),
      inject: [ConfigService],
    }),
    HttpModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    TerminusModule,
    ProxyModule,
    HealthModule,
  ],
  providers: [JwtStrategy],
})
export class GatewayModule {}