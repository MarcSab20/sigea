// apps/notification-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NotificationServiceModule } from './notification-service.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(NotificationServiceModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.setGlobalPrefix('api');

  // Adaptateur Redis pour Socket.IO — résilient : si Redis est injoignable,
  // on retombe sur l'adaptateur mémoire par défaut sans bloquer le démarrage.
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    const redisAdapter = new RedisIoAdapter(app);
    await redisAdapter.connectToRedis(redisUrl);
    app.useWebSocketAdapter(redisAdapter);
    logger.log('WebSocket : adaptateur Redis actif');
  } catch (e) {
    logger.warn(
      `WebSocket : adaptateur Redis indisponible (${(e as Error).message}) — repli mémoire`,
    );
  }

  const port = process.env.PORT ?? 3007;
  await app.listen(port);
  logger.log(`Notification Service SIGEA running on port ${port}`);
}
bootstrap();
