import { Module, Global } from '@nestjs/common';
import { CemaaCryptoService } from './cemaa-crypto.service';

@Global()
@Module({ providers: [CemaaCryptoService], exports: [CemaaCryptoService] })
export class SharedCryptoModule {}
