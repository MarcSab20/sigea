// apps/cemaa-service/src/cemaa-service.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { SharedCryptoModule } from '@sigea/shared-crypto';
import { AuditModule } from '@sigea/shared-audit';
import { MessagingModule } from '@sigea/shared-messaging';
import { ConsigneModule } from './consignes/consigne.module';
import { HealthModule } from './health/health.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      publicKey: process.env.JWT_PUBLIC_KEY
        ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8')
        : '',
      verifyOptions: { algorithms: ['RS256'] },
    }),
    SharedDatabaseModule,
    SharedCryptoModule,
    AuditModule,
    MessagingModule,
    ConsigneModule,
    HealthModule,
  ],
  providers: [JwtStrategy],
})
export class CemaaServiceModule {}
