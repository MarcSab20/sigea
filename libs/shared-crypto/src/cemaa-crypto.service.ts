import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { EncryptedPayload } from '@sigea/shared-types';

@Injectable()
export class CemaaCryptoService {
  private readonly algorithm = 'aes-256-gcm';

  encrypt(plaintext: string, key: Buffer): EncryptedPayload {
    if (key.length !== 32) throw new Error('Clé AES-256 invalide : doit faire 32 octets');
    const iv      = crypto.randomBytes(12); // 96 bits pour GCM
    const cipher  = crypto.createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      ciphertext: encrypted.toString('base64'),
      iv:         iv.toString('base64'),
      authTag:    cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(payload: EncryptedPayload, key: Buffer): string {
    if (key.length !== 32) throw new Error('Clé AES-256 invalide : doit faire 32 octets');
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(payload.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
    return (
      decipher.update(payload.ciphertext, 'base64', 'utf8') +
      decipher.final('utf8')
    );
  }
}
