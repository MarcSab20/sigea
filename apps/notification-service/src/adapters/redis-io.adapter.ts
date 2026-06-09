// apps/notification-service/src/adapters/redis-io.adapter.ts
// Adaptateur Socket.IO basé sur Redis : indispensable pour que broadcastToBase()
// atteigne TOUS les clients, même répartis sur plusieurs instances du
// notification-service. Sur un serveur unique il fonctionne aussi (no-op réseau).

import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(url: string): Promise<void> {
    const pubClient = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: null });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (e) => this.logger.error(`Redis pub error : ${e.message}`));
    subClient.on('error', (e) => this.logger.error(`Redis sub error : ${e.message}`));

    // S'assure que les deux connexions sont prêtes avant de créer l'adaptateur.
    await Promise.all([
      pubClient.status === 'ready' ? Promise.resolve() : pubClient.connect().catch(() => undefined),
      subClient.status === 'ready' ? Promise.resolve() : subClient.connect().catch(() => undefined),
    ]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Adaptateur Socket.IO ↔ Redis initialisé');
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      (server as { adapter: (a: unknown) => void }).adapter(this.adapterConstructor);
    }
    return server;
  }
}
