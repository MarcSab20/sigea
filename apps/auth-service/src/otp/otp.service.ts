import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@sigea/shared-database';
import { CemaaCryptoService } from '@sigea/shared-crypto';
import { EncryptedPayload } from '@sigea/shared-types';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD = 60;
const DIGITS = 6;
const DRIFT = 1;

function base32Decode(s: string): Buffer {
  let bits = 0, value = 0, idx = 0;
  const out = Buffer.alloc(Math.floor((s.length * 5) / 8));
  for (const c of s.toUpperCase().replace(/=+$/, '')) {
    const i = BASE32.indexOf(c);
    if (i === -1) continue;
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out[idx++] = (value >>> (bits - 8)) & 0xff; bits -= 8; }
  }
  return out.subarray(0, idx);
}

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16)
    | ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

function totp(secret: string, window = 0): string {
  return hotp(secret, Math.floor(Date.now() / 1000 / PERIOD) + window);
}

function verifyTotp(secret: string, token: string): boolean {
  const clean = token.replace(/\s/g, '');
  for (let w = -DRIFT; w <= DRIFT; w++) {
    if (crypto.timingSafeEqual(Buffer.from(totp(secret, w)), Buffer.from(clean.padStart(DIGITS, '0')))) {
      return true;
    }
  }
  return false;
}

@Injectable()
export class OtpService {
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: CemaaCryptoService,
  ) {
    this.appName = config.get<string>('APP_NAME') ?? 'SIGEA-FAC';
  }

  private key(): Buffer {
    const hex = process.env.MFA_ENCRYPTION_KEY ?? '';
    const buf = Buffer.from(hex, 'hex');
    if (buf.length !== 32) throw new Error('MFA_ENCRYPTION_KEY invalide (32 octets hex requis)');
    return buf;
  }

  private encryptSecret(secret: string): string {
    return JSON.stringify(this.crypto.encrypt(secret, this.key()));
  }

  private decryptSecret(stored: string): string {
    return this.crypto.decrypt(JSON.parse(stored) as EncryptedPayload, this.key());
  }

  async generateSecret(userId: string): Promise<{ secret: string; otpAuthUrl: string; qrDataUrl: string }> {
    const secret = base32Encode(crypto.randomBytes(20));
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId }, select: { login: true },
    });
    if (!user) throw new BadRequestException('Utilisateur introuvable');

    const label = encodeURIComponent(`${this.appName}:${user.login}`);
    const issuer = encodeURIComponent(this.appName);
    const otpAuthUrl =
      `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`;

    await this.prisma.otpSecret.upsert({
      where: { user_id: userId },
      update: { secret: this.encryptSecret(secret), actif: false },
      create: { user_id: userId, secret: this.encryptSecret(secret), actif: false },
    });

    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, { margin: 1, width: 220, errorCorrectionLevel: 'M' });
    return { secret, otpAuthUrl, qrDataUrl };
  }

  async activateSecret(userId: string, token: string): Promise<void> {
    const rec = await this.prisma.otpSecret.findUnique({ where: { user_id: userId } });
    if (!rec) throw new BadRequestException('Aucun secret en attente');
    if (!verifyTotp(this.decryptSecret(rec.secret), token)) {
      throw new UnauthorizedException('Code OTP invalide');
    }
    await this.prisma.otpSecret.update({ where: { user_id: userId }, data: { actif: true } });
    await this.prisma.utilisateur.update({ where: { id: userId }, data: { mfa_enrolled: true } });
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const rec = await this.prisma.otpSecret.findUnique({ where: { user_id: userId } });
    if (!rec?.actif) return false;
    return verifyTotp(this.decryptSecret(rec.secret), token);
  }

  async hasActiveSecret(userId: string): Promise<boolean> {
    const rec = await this.prisma.otpSecret.findUnique({ where: { user_id: userId } });
    return rec?.actif === true;
  }

  async reset(userId: string): Promise<void> {
    await this.prisma.otpSecret.deleteMany({ where: { user_id: userId } });
    await this.prisma.utilisateur.update({ where: { id: userId }, data: { mfa_enrolled: false } });
  }
}