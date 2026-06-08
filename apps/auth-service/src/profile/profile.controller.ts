import { Controller, Get, Patch, Post, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '@sigea/shared-auth';
import { JwtPayload } from '@sigea/shared-types';
import { IsBoolean, IsOptional, IsEmail, IsString, MaxLength } from 'class-validator';
import { ProfileService } from './profile.service';

class PrefsDto {
  @IsOptional() @IsBoolean() notif_connexion?: boolean;
  @IsOptional() @IsBoolean() notif_par_email?: boolean;
  @IsOptional() @IsEmail() email?: string;
}
class ResetDto {
  @IsOptional() @IsString() @MaxLength(300) motif?: string;
}

@Controller('auth/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  me(@CurrentUser() u: JwtPayload) {
    return this.profile.get(u.sub);
  }

  @Get('notifications')
  notifications(@CurrentUser() u: JwtPayload) {
    return this.profile.notifications(u.sub);
  }

  @Patch('notifications/:id/lu')
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload) {
    return this.profile.markRead(u.sub, id);
  }

  @Patch('preferences')
  updatePrefs(@Body() dto: PrefsDto, @CurrentUser() u: JwtPayload) {
    return this.profile.updatePreferences(u.sub, dto);
  }

  @Post('mfa-reset-request')
  requestReset(@Body() dto: ResetDto, @CurrentUser() u: JwtPayload) {
    return this.profile.requestMfaReset(u.sub, dto.motif);
  }
}