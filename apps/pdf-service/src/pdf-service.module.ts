// apps/pdf-service/src/pdf-service.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { SharedCryptoModule } from '@sigea/shared-crypto';
import { PdfService } from './pdf/pdf.service';
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
    HealthModule,
  ],
  providers: [PdfService, JwtStrategy],
})
export class PdfServiceModule {}