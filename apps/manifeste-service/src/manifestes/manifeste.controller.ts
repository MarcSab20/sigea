import { Controller, Post, Get, Patch, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard, BaseCloisonnementGuard, RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { Audit } from '@sigea/shared-audit';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { ManifesteService } from './manifeste.service';
import { CreateManifesteDto } from './dto/create-manifeste.dto';

@Controller('manifestes')
@UseGuards(JwtAuthGuard, BaseCloisonnementGuard)
export class ManifesteController {
  constructor(private readonly manifesteService: ManifesteService) {}

  @Post()
  @Roles(RoleUtilisateur.CHEF_ESCALE)
  @UseGuards(RolesGuard)
  @Audit('manifeste.create')
  create(@Body() dto: CreateManifesteDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.manifesteService.create({ ...dto, base_id: user.base_id, cree_par: user.sub });
  }

  @Get()
  @Audit('manifeste.list')
  findAll(@CurrentUser() user: JwtPayload): Promise<unknown[]> {
    return this.manifesteService.findAllByBase(user.base_id);
  }

  @Get(':id')
  @Audit('manifeste.view')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.manifesteService.findOne(id, user.base_id);
  }

  @Patch(':id/soumettre')
  @Roles(RoleUtilisateur.CHEF_ESCALE)
  @UseGuards(RolesGuard)
  @Audit('manifeste.soumettre')
  soumettre(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.manifesteService.soumettre(id, user.base_id);
  }
}
