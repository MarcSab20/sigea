import { Controller, Post, Patch, Get, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@sigea/shared-auth';
import { RoleUtilisateur } from '@sigea/shared-types';
import { AdminService } from './admin.service';
import { CreateUtilisateurDto } from './dto/create-utilisateur.dto';
import { UpdateUtilisateurDto } from './dto/update-utilisateur.dto';
import { CreateBaseDto, UpdateBaseDto } from './dto/create-base.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('utilisateurs')
  createUser(@Body() dto: CreateUtilisateurDto): Promise<unknown> {
    return this.admin.createUtilisateur(dto);
  }

  @Patch('utilisateurs/:id')
  updateUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUtilisateurDto): Promise<unknown> {
    return this.admin.updateUtilisateur(id, dto);
  }

  @Post('bases')
  createBase(@Body() dto: CreateBaseDto): Promise<unknown> {
    return this.admin.createBase(dto);
  }

  @Patch('bases/:id')
  updateBase(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBaseDto): Promise<unknown> {
    return this.admin.updateBase(id, dto);
  }

  @Get('audit-logs')
  auditLogs(): Promise<unknown[]> {
    return this.admin.auditLogs();
  }
}