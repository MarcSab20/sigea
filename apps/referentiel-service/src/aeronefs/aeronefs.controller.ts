import { Controller, Get } from '@nestjs/common';
import { AeronefsService } from './aeronefs.service';

@Controller('referentiel/aeronefs')
export class AeronefsController {
  constructor(private readonly aeronefsService: AeronefsService) {}

  @Get()
  findAll(): Promise<unknown[]> {
    return this.aeronefsService.findAll();
  }
}