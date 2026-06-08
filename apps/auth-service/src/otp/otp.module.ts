import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({ imports: [SharedDatabaseModule], providers: [OtpService], exports: [OtpService] })
export class OtpModule {}