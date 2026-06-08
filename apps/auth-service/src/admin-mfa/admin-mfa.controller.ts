import { Controller, Get, Post, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminMfaService } from './admin-mfa.service';

class MotifDto {
  @IsOptional() @IsString() @MaxLength(300) motif?: string;
}

@Controller('auth/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.ADMIN)
export class AdminMfaController {
  constructor(private readonly admin: AdminMfaService) {}

  @Get('mfa-reset-requests')
  pending() {
    return this.admin.pendingRequests();
  }

  @Post('mfa-reset-requests/:id/approuver')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload) {
    return this.admin.approveRequest(id, u.sub);
  }

  @Post('mfa-reset-requests/:id/rejeter')
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload) {
    return this.admin.rejectRequest(id, u.sub);
  }

  @Post('utilisateurs/:id/reset-mfa')
  forceReset(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload) {
    return this.admin.forceReset(id, u.sub);
  }

  @Post('utilisateurs/:id/deverrouiller')
  unlock(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MotifDto, @CurrentUser() u: JwtPayload) {
    return this.admin.unlock(id, u.sub, dto.motif);
  }

  @Get('security-alerts')
  alerts() {
    return this.admin.alerts();
  }
}