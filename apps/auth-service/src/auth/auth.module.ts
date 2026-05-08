import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { OtpModule } from '../otp/otp.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    UsersModule,
    OtpModule,
    SessionModule,
    JwtModule,   // ← manquait — JwtModule est global dans AuthServiceModule mais doit être importé ici aussi
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}