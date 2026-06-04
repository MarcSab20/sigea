// apps/vol-service/src/vols/vols.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { VolsService } from './vols.service';
import { CreateVolDto } from './dto/create-vol.dto';

@Controller('vols')
@UseGuards(JwtAuthGuard)
export class VolsController {
  constructor(private readonly volsService: VolsService) {}

  @Post()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.COMBASE)
  @UseGuards(RolesGuard)
  create(@Body() dto: CreateVolDto): Promise<unknown> {
    return this.volsService.create(dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<unknown[]> {
    return this.volsService.findAll(user.base_id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.volsService.findOne(id);
  }
}