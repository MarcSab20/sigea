import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationGateway } from './gateway/notification.gateway';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      useFactory: () => ({
        publicKey: process.env.JWT_PUBLIC_KEY
          ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64')
          : undefined,
        verifyOptions: { algorithms: ['RS256'] },
      }),
    }),
    HealthModule,
  ],
  providers: [NotificationGateway],
})
export class NotificationServiceModule {}