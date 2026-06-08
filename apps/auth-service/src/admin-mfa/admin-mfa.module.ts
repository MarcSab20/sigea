import { Module } from '@nestjs/common';
import { AdminMfaController } from './admin-mfa.controller';
import { AdminMfaService } from './admin-mfa.service';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { OtpModule } from '../otp/otp.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [SharedDatabaseModule, OtpModule, SecurityModule],
  controllers: [AdminMfaController],
  providers: [AdminMfaService],
})
export class AdminMfaModule {}