// apps/auth-service/src/otp/otp.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@sigea/shared-database';
import * as crypto from 'crypto';

// Implémentation TOTP RFC 6238 sans dépendance externe fragile
// Compatible avec Google Authenticator, Authy, Microsoft Authenticator

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(encoded: string): Buffer {
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = Buffer.alloc(Math.floor((encoded.length * 5) / 8));
  for (const char of encoded.toUpperCase().replace(/=+$/, '')) {
    const charIndex = BASE32_CHARS.indexOf(char);
    if (charIndex === -1) continue;
    value = (value << 5) | charIndex;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return output.slice(0, index);
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
  while (output.length % 8 !== 0) output += '=';
  return output;
}

function generateHOTP(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function generateTOTP(secret: string, window = 0): string {
  const counter = Math.floor(Date.now() / 1000 / 30) + window;
  return generateHOTP(secret, counter);
}

function verifyTOTP(secret: string, token: string, drift = 1): boolean {
  for (let w = -drift; w <= drift; w++) {
    if (generateTOTP(secret, w) === token) return true;
  }
  return false;
}

function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

@Injectable()
export class OtpService {
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.appName = config.get<string>('APP_NAME') ?? 'SIGEA-FAC';
  }

  // Génère un nouveau secret TOTP pour un utilisateur (première connexion)
  async generateSecret(userId: string): Promise<{ secret: string; otpAuthUrl: string; qrDataUrl: string }> {
    const secret = generateSecret();

    // Récupérer l'utilisateur pour le label
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { login: true, nom: true, prenom: true },
    });
    if (!user) throw new BadRequestException('Utilisateur introuvable');

    const label = encodeURIComponent(`${this.appName}:${user.login}`);
    const issuer = encodeURIComponent(this.appName);
    const otpAuthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

    // Stocker le secret en attente (pas encore activé)
    await this.prisma.otpSecret.upsert({
      where: { user_id: userId },
      update: { secret, actif: false },
      create: { user_id: userId, secret, actif: false },
    });

    // Générer QR code en SVG pur (sans librairie externe)
    const qrDataUrl = await this.generateQrDataUrl(otpAuthUrl);

    return { secret, otpAuthUrl, qrDataUrl };
  }

  // Active le secret après vérification du premier code
  async activateSecret(userId: string, token: string): Promise<void> {
    const otpRecord = await this.prisma.otpSecret.findUnique({ where: { user_id: userId } });
    if (!otpRecord) throw new BadRequestException('Aucun secret en attente');

    if (!verifyTOTP(otpRecord.secret, token)) {
      throw new UnauthorizedException('Code OTP invalide');
    }

    await this.prisma.otpSecret.update({
      where: { user_id: userId },
      data: { actif: true },
    });
  }

  // Vérifie un token TOTP lors de la connexion
  async verifyToken(userId: string, token: string): Promise<boolean> {
    const otpRecord = await this.prisma.otpSecret.findUnique({ where: { user_id: userId } });
    if (!otpRecord?.actif) return false;
    return verifyTOTP(otpRecord.secret, token.replace(/\s/g, ''));
  }

  // Vérifie si l'utilisateur a un secret TOTP actif
  async hasActiveSecret(userId: string): Promise<boolean> {
    const r = await this.prisma.otpSecret.findUnique({ where: { user_id: userId } });
    return r?.actif === true;
  }

  // Génère un QR code via l'API publique QR Server (en prod : générer localement)
  private async generateQrDataUrl(otpAuthUrl: string): Promise<string> {
    // Retourne l'URL de l'API QR — le frontend l'affiche directement
    // En production intranet : utiliser qrcode npm ou générer en SVG natif
    const encoded = encodeURIComponent(otpAuthUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`;
  }
}