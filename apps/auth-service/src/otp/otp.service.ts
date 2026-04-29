import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService) {}

  async verify(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.utilisateur.findUnique({ where: { id: userId } });
    if (!user?.otp_secret) return false;
    return authenticator.verify({ token, secret: user.otp_secret });
  }

  async setup(userId: string): Promise<{ qr_code: string; secret: string }> {
    const secret = authenticator.generateSecret();
    const user   = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: userId } });
    const otpUrl = authenticator.keyuri(user.login, 'SIGEA-FAC', secret);
    const qrCode = await qrcode.toDataURL(otpUrl);
    // Stocker le secret chiffré (implémentation CemaaCryptoService)
    await this.prisma.utilisateur.update({ where: { id: userId }, data: { otp_secret: secret } });
    return { qr_code: qrCode, secret };
  }
}
