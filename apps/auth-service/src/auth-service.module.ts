import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OtpModule } from './otp/otp.module';
import { SessionModule } from './session/session.module';
import { HealthModule } from './health/health.module';
import authConfig from './config/auth.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [authConfig] }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        privateKey:  process.env.JWT_PRIVATE_KEY ?? '',
        publicKey:   process.env.JWT_PUBLIC_KEY  ?? '',
        signOptions: { algorithm: 'RS256', expiresIn: (process.env.JWT_ACCESS_EXPIRY ?? '15m') as any },
      }),
    }),
    AuthModule,
    UsersModule,
    OtpModule,
    SessionModule,
    HealthModule,
  ],
})
export class AuthServiceModule {}
