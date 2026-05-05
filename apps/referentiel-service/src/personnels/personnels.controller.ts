import { Controller, Get } from '@nestjs/common';
import { PersonnelsService } from './personnels.service';

@Controller('referentiel/personnels')
export class PersonnelsController {
  constructor(private readonly personnelsService: PersonnelsService) {}

  @Get()
  findAll(): Promise<unknown[]> {
    return this.personnelsService.findAll();
  }
}