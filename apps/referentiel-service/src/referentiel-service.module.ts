import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { BasesModule } from './bases/bases.module';
import { AeronefsModule } from './aeronefs/aeronefs.module';
import { PersonnelsModule } from './personnels/personnels.module';
import { UnitesModule } from './unites/unites.module';
import { AdminModule } from './admin/admin.module';
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
    BasesModule,
    AeronefsModule,
    PersonnelsModule,
    UnitesModule,
    AdminModule,
    HealthModule,
  ],
  providers: [JwtStrategy],
})
export class ReferentielServiceModule {}