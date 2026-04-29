import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UsersService } from '../../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({ usernameField: 'login' });
  }

  async validate(login: string, password: string): Promise<unknown> {
    const user = await this.usersService.validateCredentials(login, password);
    if (!user) throw new UnauthorizedException('Identifiants invalides');
    return user;
  }
}
