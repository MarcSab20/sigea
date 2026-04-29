export const RABBITMQ_CONFIG = {
  transport: 'RABBITMQ' as const,
  options: {
    urls: [process.env.RABBITMQ_URL ?? 'amqp://sigea:sigea@localhost:5672'],
    queue: 'sigea_main_queue',
    queueOptions: { durable: true },
    noAck: false,
    prefetchCount: 10,
  },
} as const;
