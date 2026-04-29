import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '@sigea/shared-types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
