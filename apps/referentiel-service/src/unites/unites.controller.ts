import { Controller, Get } from '@nestjs/common';
import { UnitesService } from './unites.service';

@Controller('referentiel/unites')
export class UnitesController {
  constructor(private readonly unitesService: UnitesService) {}

  @Get()
  findAll(): Promise<unknown[]> {
    return this.unitesService.findAll();
  }
}