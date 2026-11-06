import {
  Controller, Post, Body, HttpCode, HttpStatus, Req, Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService, LoginResult } from './auth.service';
import { IsString, MinLength, Length, IsOptional, IsBoolean } from 'class-validator';

// ═══════════════════════════════════════════════════════════════════════════
// LE JETON DE RAFRAÎCHISSEMENT NE QUITTE PLUS LE NAVIGATEUR EN CLAIR
// ═══════════════════════════════════════════════════════════════════════════
// Il est désormais posé en cookie HttpOnly et n'apparaît plus dans le corps de
// la réponse. Aucun script de la page ne peut le lire — ni une extension, ni
// une injection. C'est la seule protection réellement efficace contre
// l'exfiltration d'un jeton de huit heures.
//
// Le jeton d'ACCÈS, lui, reste dans le corps : il vit dix minutes, il doit
// être lisible pour alimenter l'en-tête Authorization, et le mettre en cookie
// exposerait l'application aux attaques CSRF sans rien gagner.
//
// Conséquence à connaître : le client n'a plus rien à stocker ni à renvoyer.
// `POST /auth/refresh` se fait sans corps, le navigateur joint le cookie.

const COOKIE_REFRESH = 'sigea_refresh';

/**
 * Durée du cookie, alignée sur celle du jeton qu'il transporte (8 h).
 *
 * Les deux DOIVENT rester cohérentes : un cookie qui survit au jeton produit
 * des rafraîchissements rejetés sans explication, et un cookie plus court
 * déconnecte un utilisateur dont le jeton était encore valable.
 */
const DUREE_REFRESH_MS = 8 * 60 * 60 * 1000;

/**
 * Chemin du cookie.
 *
 * Restreint aux routes d'authentification : le navigateur ne le joindra pas
 * aux appels métier. Un jeton de rafraîchissement n'a aucune raison de
 * traverser le réseau à chaque requête de liste — moins il circule, moins il
 * est interceptable.
 */
const COOKIE_PATH = '/api/auth';

/**
 * En production, le frontend et la passerelle peuvent être servis par des
 * origines distinctes. Le cookie doit alors être `SameSite=None; Secure`, ce
 * qui exige HTTPS. En développement, `Lax` suffit et fonctionne en clair.
 *
 * Piloté par l'environnement plutôt que codé en dur : un `SameSite=None` sans
 * HTTPS est silencieusement ignoré par les navigateurs, et le défaut se
 * manifesterait par une déconnexion à chaque rechargement — exactement le
 * symptôme que cette modification corrige.
 */
function optionsCookie(): {
  httpOnly: true; sameSite: 'lax' | 'none'; secure: boolean; path: string; maxAge?: number;
} {
  const production = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: production ? 'none' : 'lax',
    secure: production,
    path: COOKIE_PATH,
  };
}

/**
 * Lit un cookie dans l'en-tête `Cookie`.
 *
 * Écrit à la main plutôt qu'avec `cookie-parser` : une dépendance de plus pour
 * six lignes, dans un service qui n'a aucun autre usage des cookies. La
 * découpe suit la grammaire de la RFC 6265 — paires séparées par `; `, valeur
 * pouvant contenir des `=`.
 */
function lireCookie(req: Request, nom: string): string | undefined {
  const brut = req.headers.cookie;
  if (!brut) return undefined;
  for (const paire of brut.split(';')) {
    const i = paire.indexOf('=');
    if (i === -1) continue;
    if (paire.slice(0, i).trim() === nom) {
      return decodeURIComponent(paire.slice(i + 1).trim());
    }
  }
  return undefined;
}

function ctxFrom(req: Request) {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
    fingerprint: req.headers['x-device-fingerprint'] as string | undefined,
    userAgent: req.headers['user-agent'] as string | undefined,
  };
}

class LoginDto {
  @IsString() login!: string;
  @IsString() @MinLength(1) password!: string;
  @IsOptional() @IsBoolean() first_connection?: boolean;
}
class OtpDto {
  @IsString() challenge_token!: string;
  @IsString() @Length(6, 6) otp_code!: string;
}
class BackupDto {
  @IsString() challenge_token!: string;
  @IsString() backup_code!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Pose le cookie et RETIRE le jeton du corps de la réponse.
   *
   * Le retrait est aussi important que la pose : laisser `refresh_token` dans
   * le JSON le rendrait lisible par le script de la page, et le cookie
   * HttpOnly ne protégerait plus rien.
   */
  private avecCookie(res: Response, resultat: LoginResult): LoginResult {
    if (resultat.refresh_token) {
      res.cookie(COOKIE_REFRESH, resultat.refresh_token, {
        ...optionsCookie(),
        maxAge: DUREE_REFRESH_MS,
      });
    }
    const { refresh_token: _retire, ...sansJeton } = resultat;
    return sansJeton;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    // Aucun cookie ici : cette étape ne délivre qu'un jeton de défi, et
    // l'authentification n'est pas encore acquise tant que le second facteur
    // n'a pas été vérifié.
    return this.authService.login(
      dto.login, dto.password, dto.first_connection ?? false, ctxFrom(req),
    );
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async verifyOtp(
    @Body() dto: OtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    // `passthrough: true` : NestJS continue de sérialiser la valeur retournée.
    // Sans cette option, accéder à `res` désactive la sérialisation
    // automatique et la réponse resterait vide.
    return this.avecCookie(res, await this.authService.verifyOtp(
      dto.challenge_token, dto.otp_code, ctxFrom(req),
    ));
  }

  @Post('activate-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async activateOtp(
    @Body() dto: OtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    return this.avecCookie(res, await this.authService.activateAndVerifyOtp(
      dto.challenge_token, dto.otp_code, ctxFrom(req),
    ));
  }

  @Post('verify-backup-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyBackup(
    @Body() dto: BackupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    return this.avecCookie(res, await this.authService.verifyBackupCode(
      dto.challenge_token, dto.backup_code, ctxFrom(req),
    ));
  }

  /**
   * Rafraîchit le jeton d'accès à partir du cookie.
   *
   * Le corps de la requête n'est plus lu. Un client qui enverrait encore
   * `{ refresh_token }` serait ignoré : accepter les deux sources laisserait
   * ouverte la voie que ce changement ferme.
   *
   * @Throttle est posé ici parce que cette route est la seule que le client
   * appelle sans intervention humaine : une boucle d'intercepteur mal réglée
   * pourrait la marteler.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Req() req: Request) {
    const token = lireCookie(req, COOKIE_REFRESH);
    if (!token) {
      throw new UnauthorizedException('Session expirée — reconnectez-vous');
    }
    return this.authService.refresh(token);
  }

  /**
   * Efface le cookie.
   *
   * `clearCookie` n'agit que si le chemin et les options correspondent
   * EXACTEMENT à ceux de la pose : un cookie posé sur `/api/auth` et effacé
   * sur `/` survivrait, et l'utilisateur resterait connectable après avoir
   * cliqué sur Déconnexion.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_REFRESH, optionsCookie());
  }
}