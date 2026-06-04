// apps/manifeste-service/src/materiels/materiels.controller.ts
import { Controller, Post, Get, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, BaseCloisonnementGuard, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { Audit } from '@sigea/shared-audit';
import { MaterielsService } from './materiels.service';
import { CreateMaterielDto } from './dto/create-materiel.dto';

@Controller('manifestes/:manifesteId/materiels')
@UseGuards(JwtAuthGuard, BaseCloisonnementGuard)
export class MaterielsController {
  constructor(private readonly materielsService: MaterielsService) {}

  @Post()
  @Roles(RoleUtilisateur.CHEF_ESCALE)
  @UseGuards(RolesGuard)
  @Audit('materiel.create')
  create(
    @Param('manifesteId', ParseUUIDPipe) manifesteId: string,
    @Body() dto: CreateMaterielDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.materielsService.create(manifesteId, dto, user.base_id);
  }

  @Get()
  findAll(
    @Param('manifesteId', ParseUUIDPipe) manifesteId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown[]> {
    return this.materielsService.findAll(manifesteId, user.base_id);
  }

  @Delete(':id')
  @Roles(RoleUtilisateur.CHEF_ESCALE)
  @UseGuards(RolesGuard)
  remove(
    @Param('manifesteId', ParseUUIDPipe) manifesteId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.materielsService.remove(id, manifesteId);
  }
}