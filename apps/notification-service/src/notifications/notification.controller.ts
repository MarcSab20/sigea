// apps/notification-service/src/notifications/notification.controller.ts
import {
  Controller, Get, Patch, Param, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@sigea/shared-auth';
import { JwtPayload } from '@sigea/shared-types';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  /** Non-lues de l'utilisateur courant (rattrapage REST, complément du WS). */
  @Get('unread')
  nonLues(@CurrentUser() user: JwtPayload): Promise<unknown[]> {
    return this.service.nonLues(user.sub, user.base_id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async marquerLu(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.service.marquerLu(id, user.sub, user.base_id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async marquerToutLu(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.service.marquerToutLu(user.sub, user.base_id);
  }
}