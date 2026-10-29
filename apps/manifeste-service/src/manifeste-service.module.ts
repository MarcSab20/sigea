// apps/manifeste-service/src/manifeste-service.module.ts
//
// PassagersModule et MaterielsModule sont RETIRÉS : la saisie appartient au
// secrétaire de l'Adjoint Air, dans liste-service. Leurs dossiers sont à
// supprimer du dépôt — les laisser en place exposerait des routes d'écriture
// qui contournent tout le circuit de validation.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { AuditModule } from '@sigea/shared-audit';
import { ManifesteModule } from './manifestes/manifeste.module';
import { ExploitationModule } from './exploitation/exploitation.module';
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
    AuditModule,
    ManifesteModule,
    ExploitationModule,
    HealthModule,
  ],
  providers: [JwtStrategy],
})
export class ManifesteServiceModule {}