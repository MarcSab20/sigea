import { registerAs } from '@nestjs/config';

export default registerAs('gateway', () => ({
  services: {
    auth:          process.env.AUTH_SERVICE_URL          ?? 'http://auth-service:3001',
    referentiel:   process.env.REFERENTIEL_SERVICE_URL   ?? 'http://referentiel-service:3002',
    vol:           process.env.VOL_SERVICE_URL           ?? 'http://vol-service:3003',
    manifeste:     process.env.MANIFESTE_SERVICE_URL     ?? 'http://manifeste-service:3004',
    validation:    process.env.VALIDATION_SERVICE_URL    ?? 'http://validation-service:3005',
    cemaa:         process.env.CEMAA_SERVICE_URL         ?? 'http://cemaa-service:3006',
    notification:  process.env.NOTIFICATION_SERVICE_URL  ?? 'http://notification-service:3007',
    pdf:           process.env.PDF_SERVICE_URL           ?? 'http://pdf-service:3008',
  },
  jwt: {
    publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH ?? './keys/jwt.public.key',
    expiry:        process.env.JWT_ACCESS_EXPIRY   ?? '15m',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  },
}));
