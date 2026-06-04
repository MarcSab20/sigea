// apps/manifeste-service/src/passagers/passagers.controller.ts
import { Controller, Post, Get, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, BaseCloisonnementGuard, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { Audit } from '@sigea/shared-audit';
import { PassagersService } from './passagers.service';
import { CreatePassagerDto } from './dto/create-passager.dto';

@Controller('manifestes/:manifesteId/passagers')
@UseGuards(JwtAuthGuard, BaseCloisonnementGuard)
export class PassagersController {
  constructor(private readonly passagersService: PassagersService) {}

  @Post()
  @Roles(RoleUtilisateur.CHEF_ESCALE)
  @UseGuards(RolesGuard)
  @Audit('passager.create')
  create(
    @Param('manifesteId', ParseUUIDPipe) manifesteId: string,
    @Body() dto: CreatePassagerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.passagersService.create(manifesteId, dto, user.base_id);
  }

  @Get()
  @Audit('passager.list')
  findAll(
    @Param('manifesteId', ParseUUIDPipe) manifesteId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown[]> {
    return this.passagersService.findAll(manifesteId, user.base_id);
  }

  @Delete(':id')
  @Roles(RoleUtilisateur.CHEF_ESCALE)
  @UseGuards(RolesGuard)
  @Audit('passager.delete')
  remove(
    @Param('manifesteId', ParseUUIDPipe) manifesteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.passagersService.remove(id, manifesteId, user.base_id);
  }
}