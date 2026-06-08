import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SharedCryptoModule } from '@sigea/shared-crypto';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OtpModule } from './otp/otp.module';
import { SessionModule } from './session/session.module';
import { BackupCodeModule } from './backup/backup-code.module';
import { SecurityModule } from './security/security.module';
import { ProfileModule } from './profile/profile.module';
import { AdminMfaModule } from './admin-mfa/admin-mfa.module';
import { HealthModule } from './health/health.module';
import { ProxyAwareThrottlerGuard } from './common/proxy-throttler.guard';
import authConfig from './config/auth.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [authConfig] }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        privateKey: process.env.JWT_PRIVATE_KEY
          ? Buffer.from(process.env.JWT_PRIVATE_KEY, 'base64').toString('utf8') : '',
        publicKey: process.env.JWT_PUBLIC_KEY
          ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8') : '',
        signOptions: { algorithm: 'RS256', expiresIn: (process.env.JWT_ACCESS_EXPIRY ?? '10m') as any },
      }),
    }),
    SharedCryptoModule,
    AuthModule, UsersModule, OtpModule, SessionModule,
    BackupCodeModule, SecurityModule, ProfileModule, AdminMfaModule, HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ProxyAwareThrottlerGuard }],
})
export class AuthServiceModule {}