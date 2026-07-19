import {
  Controller, Post, Patch, Get, Body, Param, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { Audit } from '@sigea/shared-audit';
import { ConsigneService } from './consigne.service';
import { CreateConsigneDto, UpdateConsigneDto } from './dto/create-consigne.dto';

@Controller('cemaa/consignes')
@UseGuards(JwtAuthGuard)
export class ConsigneController {
  constructor(private readonly consigneService: ConsigneService) {}

  @Post()
  @Roles(RoleUtilisateur.CEMAA)
  @UseGuards(RolesGuard)
  @Audit('cemaa.consigne.create')
  create(@Body() dto: CreateConsigneDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.consigneService.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.CEMAA)
  @UseGuards(RolesGuard)
  @Audit('cemaa.consigne.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsigneDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.consigneService.update(id, dto, user.sub);
  }

  // Métadonnées des consignes d'un vol (contenu chiffré NON déchiffré ici :
  // la lecture du contenu passe par une route dédiée réservée au CEMAA).
  @Get('vol/:volId')
  @Audit('cemaa.consigne.view')
  findByVol(@Param('volId', ParseUUIDPipe) volId: string): Promise<unknown[]> {
    return this.consigneService.findByVol(volId);
  }
}