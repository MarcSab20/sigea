import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { OtpModule } from '../otp/otp.module';
import { SessionModule } from '../session/session.module';
import { BackupCodeModule } from '../backup/backup-code.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [UsersModule, OtpModule, SessionModule, BackupCodeModule, SecurityModule],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}