import { Controller, Post, Get, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { Audit } from '@sigea/shared-audit';
import { ConsigneService } from './consigne.service';
import { CreateConsigneDto } from './dto/create-consigne.dto';

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

  @Get('vol/:volId')
  @Audit('cemaa.consigne.view')
  findByVol(@Param('volId', ParseUUIDPipe) volId: string): Promise<unknown[]> {
    return this.consigneService.findByVol(volId);
  }
}
