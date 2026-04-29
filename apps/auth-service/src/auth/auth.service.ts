import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UsersService } from '../users/users.service';
import { OtpService } from '../otp/otp.service';
import { SessionService } from '../session/session.service';
import { JwtPayload, RoleUtilisateur } from '@sigea/shared-types';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
  ) {}

  async login(dto: LoginDto): Promise<{ challenge_token: string }> {
    const user = await this.usersService.validateCredentials(dto.login, dto.password);
    if (!user) throw new UnauthorizedException('Identifiants invalides');

    // Étape 1 : retourne un token temporaire pour la validation OTP
    const challengeToken = this.jwtService.sign(
      { sub: user.id, step: 'otp_required' },
      { expiresIn: '5m' },
    );
    return { challenge_token: challengeToken };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ access_token: string; refresh_token: string }> {
    let payload: { sub: string; step: string };
    try {
      payload = this.jwtService.verify(dto.challenge_token);
    } catch {
      throw new UnauthorizedException('Token de challenge invalide ou expiré');
    }

    if (payload.step !== 'otp_required') throw new UnauthorizedException('Flux invalide');

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');

    const otpValid = await this.otpService.verify(user.id, dto.otp_code);
    if (!otpValid) throw new UnauthorizedException('Code OTP invalide');

    const jti = crypto.randomUUID();
    const jwtPayload: JwtPayload = {
      sub: user.id, role: user.role as RoleUtilisateur,
      base_id: user.base_id, jti, iat: 0, exp: 0,
    };

    const accessToken  = this.jwtService.sign(jwtPayload);
    const refreshToken = crypto.randomBytes(64).toString('hex');
    await this.sessionService.createSession(user.id, refreshToken);

    this.logger.log(`Login réussi : ${user.login} (base: ${user.base_id})`);
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async refreshToken(token: string): Promise<{ access_token: string }> {
    // Délégué au SessionService — implémentation complète en Phase 1
    const userId = await this.sessionService.validateAndGetUserId(token);
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    const jti = crypto.randomUUID();
    const accessToken = this.jwtService.sign({
      sub: user.id, role: user.role, base_id: user.base_id, jti,
    });
    return { access_token: accessToken };
  }

  async logout(userId: string, jti: string): Promise<void> {
    await this.sessionService.revokeSession(userId, jti);
  }

  async setupOtp(userId: string): Promise<{ qr_code: string; secret: string }> {
    return this.otpService.setup(userId);
  }
}
