import { Controller, Get } from '@nestjs/common';

/**
 * Health de la gateway : liveness pure.
 * La gateway est un proxy sans base de données — elle NE doit pas injecter
 * PrismaService (ce qui provoquait un crash de démarrage : PrismaService
 * introuvable dans HealthModule). Les services métier, eux, sondent bien leur DB.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'gateway', ts: new Date().toISOString() };
  }
}