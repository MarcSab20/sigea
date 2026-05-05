import { Controller, Get } from '@nestjs/common';
import { BasesService } from './bases.service';

@Controller('referentiel/bases')
export class BasesController {
  constructor(private readonly basesService: BasesService) {}

  @Get()
  findAll(): Promise<unknown[]> {
    return this.basesService.findAll();
  }
}