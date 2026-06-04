// apps/auth-service/src/auth/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsString, MinLength, Length } from 'class-validator';

class LoginDto {
  @IsString() login!: string;
  @IsString() @MinLength(1) password!: string;
}

class VerifyOtpDto {
  @IsString() challenge_token!: string;
  @IsString() @Length(6, 6) otp_code!: string;
}

class ActivateOtpDto {
  @IsString() challenge_token!: string;
  @IsString() @Length(6, 6) otp_code!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Étape 1 — login (identifiants)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.login, dto.password);
  }

  // Étape 2a — vérifier OTP (connexions suivantes)
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.challenge_token, dto.otp_code);
  }

  // Étape 2b — activer OTP après scan QR (première connexion)
  @Post('activate-otp')
  @HttpCode(HttpStatus.OK)
  activateOtp(@Body() dto: ActivateOtpDto) {
    return this.authService.activateAndVerifyOtp(dto.challenge_token, dto.otp_code);
  }

  // Logout — invalider le refresh token côté serveur
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout() {
    return { success: true };
  }

  // Refresh token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { refresh_token: string }) {
    return this.authService.refresh(body.refresh_token);
  }
}