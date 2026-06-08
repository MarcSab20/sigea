import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { IsString, MinLength, Length, IsOptional, IsBoolean } from 'class-validator';

function ctxFrom(req: Request) {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
    fingerprint: req.headers['x-device-fingerprint'] as string | undefined,
    userAgent: req.headers['user-agent'] as string | undefined,
  };
}

class LoginDto {
  @IsString() login!: string;
  @IsString() @MinLength(1) password!: string;
  @IsOptional() @IsBoolean() first_connection?: boolean;
}
class OtpDto {
  @IsString() challenge_token!: string;
  @IsString() @Length(6, 6) otp_code!: string;
}
class BackupDto {
  @IsString() challenge_token!: string;
  @IsString() backup_code!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto.login, dto.password, dto.first_connection ?? false, ctxFrom(req));
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  verifyOtp(@Body() dto: OtpDto, @Req() req: Request) {
    return this.authService.verifyOtp(dto.challenge_token, dto.otp_code, ctxFrom(req));
  }

  @Post('activate-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  activateOtp(@Body() dto: OtpDto, @Req() req: Request) {
    return this.authService.activateAndVerifyOtp(dto.challenge_token, dto.otp_code, ctxFrom(req));
  }

  @Post('verify-backup-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  verifyBackup(@Body() dto: BackupDto, @Req() req: Request) {
    return this.authService.verifyBackupCode(dto.challenge_token, dto.backup_code, ctxFrom(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { refresh_token: string }) {
    return this.authService.refresh(body.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout() {
    return { success: true };
  }
}