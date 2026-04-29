import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from '@sigea/shared-types';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T extends JwtPayload>(err: Error | null, user: T | false): T {
    if (err || !user) throw new UnauthorizedException('Token JWT invalide ou expiré');
    return user;
  }
}
