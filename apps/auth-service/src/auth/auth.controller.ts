import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from '@sigea/shared-auth';
import { CurrentUser } from '@sigea/shared-auth';
import { JwtPayload } from '@sigea/shared-types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<{ challenge_token: string }> {
    return this.authService.login(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<{ access_token: string; refresh_token: string }> {
    return this.authService.verifyOtp(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refresh_token') token: string): Promise<{ access_token: string }> {
    return this.authService.refreshToken(token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.authService.logout(user.sub, user.jti);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
  }

  @Post('setup-otp')
  @UseGuards(JwtAuthGuard)
  setupOtp(@CurrentUser() user: JwtPayload): Promise<{ qr_code: string; secret: string }> {
    return this.authService.setupOtp(user.sub);
  }
}
